// Tuner Core — HYBRID with confidence-weighted display
//
// Detection sources and confidence levels:
//   YIN-confirmed (bandpass channel detects valid pitch) → HIGH confidence
//   FFT-only (harmonic probe sees energy, no YIN) → LOW confidence
//   FFT-only + harmonic of a YIN-confirmed string → SUPPRESSED (ghost)
//
// This naturally handles the single-string vs strum distinction:
//   Pluck one string → YIN confirms 1 string, ghosts are FFT-only + harmonic → invisible
//   Strum → multiple YIN confirmations (or all FFT with no single dominant) → all show

window.TunerCore = (function () {
    'use strict';
    var T = Tunings;
    var PD = PitchDetector;

    function TunerCore(engine) {
        this.engine = engine;
        this.strings = [];
        this.stringStates = [];
    }

    TunerCore.prototype.setStrings = function (strings) {
        this.strings = strings;
        this.stringStates = [];
        for (var i = 0; i < strings.length; i++) {
            this.stringStates.push({
                index: i,
                note: strings[i].note,
                displayName: strings[i].displayName,
                octave: strings[i].octave,
                targetFreq: strings[i].freq,
                visible: false,
                cents: 0,
                smoothedCents: 0,
                holdCounter: 0,
                smoothedStrength: 0,
            });
        }
    };

    TunerCore.prototype.process = function () {
        if (!this.engine.running || this.strings.length === 0) return;

        var sr = this.engine.sampleRate;
        var spectrum = this.engine.getSpectrum();
        var binWidth = this.engine.binWidth;
        var states = this.stringStates;
        var n = states.length;

        // ─── Phase 1: FFT probe + YIN per channel ───
        var fftScores = [];
        var fftCents = [];
        var fftEnergy = [];
        var yinConfirmed = [];  // boolean: did YIN find valid pitch?
        var yinCents = [];

        for (var i = 0; i < n; i++) {
            var s = states[i];

            // FFT probe
            var fft = this._probeFFT(spectrum, binWidth, s.targetFreq);
            fftScores[i] = fft.score;
            fftCents[i] = fft.cents;
            fftEnergy[i] = fft.energy;

            // Bandpass + YIN
            yinConfirmed[i] = false;
            yinCents[i] = 0;
            var waveform = this.engine.getChannelWaveform(i);
            if (waveform) {
                var rms = PD.rmsDb(waveform);
                if (rms > T.CHANNEL_NOISE_GATE_DB) {
                    var result = PD.detect(waveform, sr, s.targetFreq * 0.5, s.targetFreq * 2.0);
                    if (result && result.confidence > T.YIN_CONFIDENCE_MIN) {
                        var c = 1200 * Math.log2(result.freq / s.targetFreq);
                        if (Math.abs(c) <= T.CENTS_MAX) {
                            yinConfirmed[i] = true;
                            yinCents[i] = c;
                        }
                    }
                }
            }
        }

        // ─── Phase 2: Determine which strings are real ───
        var yinCount = 0;
        for (var i = 0; i < n; i++) {
            if (yinConfirmed[i]) yinCount++;
        }

        // Build suppression list: FFT-only strings that are harmonics of YIN-confirmed strings
        var suppressed = [];
        for (var i = 0; i < n; i++) suppressed[i] = false;

        if (yinCount > 0 && yinCount <= 2) {
            // We have 1-2 YIN-confirmed strings — likely a single pluck or double-stop
            // Suppress FFT-only strings that are harmonically related to a YIN string
            for (var j = 0; j < n; j++) {
                if (yinConfirmed[j]) continue; // don't suppress YIN-confirmed
                if (fftScores[j] < T.FFT_STRING_MIN_SCORE) continue; // not detected anyway

                for (var i = 0; i < n; i++) {
                    if (!yinConfirmed[i]) continue;
                    if (this._isHarmonicallyRelated(states[i].targetFreq, states[j].targetFreq)) {
                        suppressed[j] = true;
                        break;
                    }
                }
            }
        }
        // When yinCount >= 3 (strum), don't suppress — all strings are likely real
        // When yinCount === 0, don't suppress — use all FFT data we have

        // ─── Phase 3: Apply to string states ───
        for (var i = 0; i < n; i++) {
            var s = states[i];
            var fftDetected = fftScores[i] >= T.FFT_STRING_MIN_SCORE;
            var isYin = yinConfirmed[i];
            var isSuppressed = suppressed[i];

            if (isSuppressed) {
                // Ghost harmonic — don't show
                if (s.holdCounter > 0) {
                    s.holdCounter--;
                    s.smoothedStrength *= 0.9;
                } else {
                    s.visible = false;
                    s.smoothedStrength *= 0.85;
                }
                continue;
            }

            if (isYin) {
                // YIN confirmed — full confidence
                s.visible = true;
                s.holdCounter = T.HOLD_FRAMES;
                s.cents = yinCents[i];
                s.smoothedCents = s.smoothedCents * (1 - T.EMA_ALPHA) + yinCents[i] * T.EMA_ALPHA;
                s.smoothedStrength = s.smoothedStrength * 0.75 + 1.0 * 0.25; // full strength

            } else if (fftDetected) {
                // FFT only — moderate confidence
                s.visible = true;
                s.holdCounter = T.HOLD_FRAMES;
                if (Math.abs(fftCents[i]) <= T.CENTS_MAX) {
                    s.cents = fftCents[i];
                    s.smoothedCents = s.smoothedCents * (1 - T.EMA_ALPHA) + fftCents[i] * T.EMA_ALPHA;
                }
                // Lower strength for FFT-only
                var fftStr = Math.min(1, fftScores[i] / T.FFT_HARMONICS) * 0.65;
                s.smoothedStrength = s.smoothedStrength * 0.8 + fftStr * 0.2;

            } else {
                // Nothing detected — holdover
                if (s.holdCounter > 0) {
                    s.holdCounter--;
                    s.smoothedStrength *= 0.93;
                } else {
                    s.visible = false;
                    s.smoothedStrength *= 0.9;
                }
            }
        }
    };

    // Check if freqB is a harmonic (or sub-harmonic) of freqA
    TunerCore.prototype._isHarmonicallyRelated = function (freqA, freqB) {
        for (var h = 2; h <= 6; h++) {
            if (Math.abs(freqA * h - freqB) / freqB < 0.03) return true;
            if (Math.abs(freqB * h - freqA) / freqA < 0.03) return true;
        }
        return false;
    };

    TunerCore.prototype._probeFFT = function (spectrum, binWidth, targetFreq) {
        if (!spectrum) return { score: 0, cents: 0, energy: -100 };

        var harmonicsAbove = 0;
        var totalEnergy = 0;
        var bestBinDB = -Infinity;
        var bestBinFreq = 0;

        for (var h = 1; h <= T.FFT_HARMONICS; h++) {
            var freq = targetFreq * h;
            var bin = Math.round(freq / binWidth);
            if (bin < 0 || bin >= spectrum.length) continue;

            var bestDB = -Infinity;
            var bestIdx = bin;
            for (var d = -2; d <= 2; d++) {
                var idx = bin + d;
                if (idx >= 0 && idx < spectrum.length && spectrum[idx] > bestDB) {
                    bestDB = spectrum[idx];
                    bestIdx = idx;
                }
            }

            if (bestDB > T.FFT_PRESENCE_THRESHOLD) {
                harmonicsAbove++;
                totalEnergy += bestDB;
                if (h === 1 || (bestDB > bestBinDB && h <= 3)) {
                    bestBinDB = bestDB;
                    bestBinFreq = bestIdx * binWidth;
                }
            }
        }

        var cents = 0;
        if (harmonicsAbove >= T.FFT_STRING_MIN_SCORE && bestBinFreq > 0) {
            var harmonicN = Math.round(bestBinFreq / targetFreq);
            if (harmonicN < 1) harmonicN = 1;
            var inferred = bestBinFreq / harmonicN;
            cents = 1200 * Math.log2(inferred / targetFreq);
            if (Math.abs(cents) > T.CENTS_MAX) cents = 0;
        }

        return {
            score: harmonicsAbove,
            cents: cents,
            energy: harmonicsAbove > 0 ? totalEnergy / harmonicsAbove : -100,
        };
    };

    TunerCore.prototype.getOverallLevel = function () {
        var w = this.engine.getFullWaveform();
        return w ? PD.rmsDb(w) : -Infinity;
    };

    return TunerCore;
})();
