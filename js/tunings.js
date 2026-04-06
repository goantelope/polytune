// Tunings — instrument definitions and frequency tables
window.Tunings = {
    noteFreq: function (note, octave) {
        var semitones = { C: -9, 'C#': -8, Db: -8, D: -7, 'D#': -6, Eb: -6,
            E: -5, F: -4, 'F#': -3, Gb: -3, G: -2, 'G#': -1, Ab: -1,
            A: 0, 'A#': 1, Bb: 1, B: 2 };
        return 440 * Math.pow(2, (semitones[note] + (octave - 4) * 12) / 12);
    },

    instruments: {
        guitar: {
            name: 'Guitar',
            icon: '🎸',
            tunings: {
                standard:       { name: 'Standard',        strings: [['E',2],['A',2],['D',3],['G',3],['B',3],['E',4]] },
                dropD:          { name: 'Drop D',          strings: [['D',2],['A',2],['D',3],['G',3],['B',3],['E',4]] },
                openG:          { name: 'Open G',          strings: [['D',2],['G',2],['D',3],['G',3],['B',3],['D',4]] },
                openD:          { name: 'Open D',          strings: [['D',2],['A',2],['D',3],['F#',3],['A',3],['D',4]] },
                dadgad:         { name: 'DADGAD',          strings: [['D',2],['A',2],['D',3],['G',3],['A',3],['D',4]] },
                halfStepDown:   { name: 'Half Step Down',  strings: [['Eb',2],['Ab',2],['Db',3],['Gb',3],['Bb',3],['Eb',4]] },
                openE:          { name: 'Open E',          strings: [['E',2],['B',2],['E',3],['G#',3],['B',3],['E',4]] },
                dropC:          { name: 'Drop C',          strings: [['C',2],['G',2],['C',3],['F',3],['A',3],['D',4]] },
            },
        },
        banjo: {
            name: 'Banjo',
            icon: '🪕',
            tunings: {
                openG:      { name: 'Open G (Standard)',  strings: [['G',4],['D',3],['G',3],['B',3],['D',4]] },
                doubleC:    { name: 'Double C',           strings: [['G',4],['C',3],['G',3],['C',4],['D',4]] },
                openD:      { name: 'Open D',             strings: [['F#',4],['D',3],['F#',3],['A',3],['D',4]] },
                standardC:  { name: 'Standard C',         strings: [['G',4],['C',3],['G',3],['B',3],['D',4]] },
                sawmill:    { name: 'Sawmill (Modal)',     strings: [['G',4],['D',3],['G',3],['C',4],['D',4]] },
            },
        },
    },

    getStrings: function (instrumentId, tuningId) {
        var inst = this.instruments[instrumentId];
        if (!inst) return [];
        var tuning = inst.tunings[tuningId];
        if (!tuning) return [];
        return tuning.strings.map(function (s, i) {
            return {
                index: i,
                note: s[0],
                octave: s[1],
                freq: Math.round(Tunings.noteFreq(s[0], s[1]) * 100) / 100,
                displayName: s[0].replace('#', '♯').replace('b', '♭'),
            };
        });
    },

    getDefaultTuning: function (instrumentId) {
        var inst = this.instruments[instrumentId];
        if (!inst) return null;
        return Object.keys(inst.tunings)[0];
    },

    // ─── Tuning constants ───
    CHANNEL_NOISE_GATE_DB: -70,     // very low — bandpass signals are quiet
    NOISE_GATE_DB: -55,
    CENTS_IN_TUNE: 5,
    CENTS_CLOSE: 15,
    CENTS_MAX: 50,
    EMA_ALPHA: 0.06,                // heavy smoothing
    YIN_CONFIDENCE_MIN: 0.5,
    BANDPASS_Q: 2.5,                // tighter for better YIN isolation
    CHANNEL_FFT_SIZE: 4096,
    FULLRANGE_FFT_SIZE: 16384,      // large FFT for good frequency resolution
    HOLD_FRAMES: 25,
    // FFT string detection
    FFT_HARMONICS: 5,               // check fundamental + 4 harmonics
    FFT_PRESENCE_THRESHOLD: -75,    // dB threshold per harmonic bin (mic signals are quiet)
    FFT_STRING_MIN_SCORE: 2,        // need this many harmonics above threshold
};
