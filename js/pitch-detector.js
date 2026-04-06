// Pitch Detector — clean YIN autocorrelation
// Pure function: no dependencies, takes waveform + config, returns pitch
window.PitchDetector = {

    // Detect pitch from a time-domain waveform buffer.
    // Returns { freq, confidence } or null if no pitch found.
    detect: function (waveform, sampleRate, freqMin, freqMax) {
        freqMin = freqMin || 60;
        freqMax = freqMax || 1000;

        var tauMin = Math.floor(sampleRate / freqMax);
        var tauMax = Math.ceil(sampleRate / freqMin);
        var W = Math.floor(waveform.length / 2);
        if (tauMax >= W) tauMax = W - 1;
        if (tauMin < 1) tauMin = 1;

        // Step 1: Difference function
        var diff = new Float32Array(tauMax + 1);
        for (var tau = 1; tau <= tauMax; tau++) {
            var sum = 0;
            for (var j = 0; j < W; j++) {
                var d = waveform[j] - waveform[j + tau];
                sum += d * d;
            }
            diff[tau] = sum;
        }

        // Step 2: Cumulative mean normalized difference (CMND)
        var cmnd = new Float32Array(tauMax + 1);
        cmnd[0] = 1;
        var runningSum = 0;
        for (var tau = 1; tau <= tauMax; tau++) {
            runningSum += diff[tau];
            cmnd[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
        }

        // Step 3: Absolute threshold — find first tau below 0.15
        var threshold = 0.15;
        var bestTau = -1;
        for (var tau = tauMin; tau <= tauMax; tau++) {
            if (cmnd[tau] < threshold) {
                // Walk to local minimum
                while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) {
                    tau++;
                }
                bestTau = tau;
                break;
            }
        }

        // Fallback: global minimum if no threshold crossing
        if (bestTau < 0) {
            var minVal = Infinity;
            for (var tau = tauMin; tau <= tauMax; tau++) {
                if (cmnd[tau] < minVal) {
                    minVal = cmnd[tau];
                    bestTau = tau;
                }
            }
            if (minVal > 0.4) return null; // too noisy
        }

        // Step 4: Parabolic interpolation
        var refinedTau = bestTau;
        if (bestTau > 0 && bestTau < tauMax) {
            var a = cmnd[bestTau - 1];
            var b = cmnd[bestTau];
            var c = cmnd[bestTau + 1];
            var denom = a - 2 * b + c;
            if (denom !== 0) {
                refinedTau = bestTau + 0.5 * (a - c) / denom;
            }
        }

        var freq = sampleRate / refinedTau;
        var confidence = 1 - cmnd[bestTau];

        if (freq < freqMin * 0.8 || freq > freqMax * 1.2) return null;

        return { freq: freq, confidence: confidence };
    },

    // Compute RMS level in dB from a waveform buffer
    rmsDb: function (waveform) {
        var sum = 0;
        for (var i = 0; i < waveform.length; i++) {
            sum += waveform[i] * waveform[i];
        }
        var rms = Math.sqrt(sum / waveform.length);
        return rms > 0 ? 20 * Math.log10(rms) : -Infinity;
    },
};
