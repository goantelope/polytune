// Audio Engine — mic capture, full-range FFT + bandpass filter bank
window.AudioEngine = (function () {
    'use strict';

    function AudioEngine() {
        this.audioContext = null;
        this.source = null;
        this.stream = null;
        this.sampleRate = 44100;
        this.running = false;
        this.channels = [];
        this.fullAnalyser = null;
        this.fullWaveform = null;
        this.fullSpectrum = null;  // FFT magnitude data (dB)
        this.binWidth = 0;
    }

    AudioEngine.prototype.start = function () {
        var self = this;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.sampleRate = this.audioContext.sampleRate;

        return navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
            },
        }).then(function (stream) {
            self.stream = stream;
            self.source = self.audioContext.createMediaStreamSource(stream);

            // Full-range analyser for FFT spectrum + time-domain
            self.fullAnalyser = self.audioContext.createAnalyser();
            self.fullAnalyser.fftSize = Tunings.FULLRANGE_FFT_SIZE;
            self.fullAnalyser.smoothingTimeConstant = 0.2; // light smoothing
            self.source.connect(self.fullAnalyser);

            self.fullWaveform = new Float32Array(Tunings.FULLRANGE_FFT_SIZE);
            self.fullSpectrum = new Float32Array(self.fullAnalyser.frequencyBinCount);
            self.binWidth = self.sampleRate / Tunings.FULLRANGE_FFT_SIZE;

            self.running = true;
        });
    };

    AudioEngine.prototype.configureTuning = function (strings) {
        this._teardownChannels();
        this.channels = [];

        var Q = Tunings.BANDPASS_Q;

        for (var i = 0; i < strings.length; i++) {
            var s = strings[i];

            var filter = this.audioContext.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = s.freq;
            filter.Q.value = Q;

            var analyser = this.audioContext.createAnalyser();
            analyser.fftSize = Tunings.CHANNEL_FFT_SIZE;
            analyser.smoothingTimeConstant = 0.3;

            this.source.connect(filter);
            filter.connect(analyser);

            this.channels.push({
                filter: filter,
                analyser: analyser,
                waveform: new Float32Array(Tunings.CHANNEL_FFT_SIZE),
                freq: s.freq,
            });
        }
    };

    AudioEngine.prototype._teardownChannels = function () {
        for (var i = 0; i < this.channels.length; i++) {
            var ch = this.channels[i];
            try {
                this.source.disconnect(ch.filter);
                ch.filter.disconnect(ch.analyser);
            } catch (e) {}
        }
        this.channels = [];
    };

    // Get FFT magnitude spectrum (dB) from full-range analyser
    AudioEngine.prototype.getSpectrum = function () {
        if (!this.fullAnalyser) return null;
        this.fullAnalyser.getFloatFrequencyData(this.fullSpectrum);
        return this.fullSpectrum;
    };

    AudioEngine.prototype.getChannelWaveform = function (idx) {
        var ch = this.channels[idx];
        if (!ch) return null;
        ch.analyser.getFloatTimeDomainData(ch.waveform);
        return ch.waveform;
    };

    AudioEngine.prototype.getFullWaveform = function () {
        if (!this.fullAnalyser) return null;
        this.fullAnalyser.getFloatTimeDomainData(this.fullWaveform);
        return this.fullWaveform;
    };

    AudioEngine.prototype.stop = function () {
        this._teardownChannels();
        if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); });
        if (this.audioContext) this.audioContext.close();
        this.running = false;
    };

    return AudioEngine;
})();
