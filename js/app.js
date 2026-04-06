// App — entry point, selectors, main loop
(function () {
    'use strict';

    var engine, core, ui;
    var running = false;
    var currentInstrument = 'guitar';
    var currentTuning = 'standard';

    function init() {
        ui = new TunerUI(document.getElementById('tuner-canvas'));

        var instSelect = document.getElementById('instrument-select');
        var tuningSelect = document.getElementById('tuning-select');

        for (var id in Tunings.instruments) {
            var opt = document.createElement('option');
            opt.value = id;
            opt.textContent = Tunings.instruments[id].icon + ' ' + Tunings.instruments[id].name;
            instSelect.appendChild(opt);
        }

        instSelect.addEventListener('change', function () {
            currentInstrument = instSelect.value;
            populateTunings(tuningSelect, currentInstrument);
            currentTuning = tuningSelect.value;
            if (running) applyTuning();
        });

        tuningSelect.addEventListener('change', function () {
            currentTuning = tuningSelect.value;
            if (running) applyTuning();
        });

        populateTunings(tuningSelect, currentInstrument);

        document.getElementById('start-btn').addEventListener('click', function () {
            if (running) stop(); else start();
        });

        ui.render(null);
    }

    function populateTunings(select, instrumentId) {
        select.innerHTML = '';
        var inst = Tunings.instruments[instrumentId];
        if (!inst) return;
        for (var id in inst.tunings) {
            var opt = document.createElement('option');
            opt.value = id;
            opt.textContent = inst.tunings[id].name;
            select.appendChild(opt);
        }
        currentTuning = select.value;
    }

    function applyTuning() {
        var strings = Tunings.getStrings(currentInstrument, currentTuning);
        engine.configureTuning(strings);
        core.setStrings(strings);
    }

    function start() {
        engine = new AudioEngine();
        engine.start().then(function () {
            core = new TunerCore(engine);
            applyTuning();
            running = true;
            document.getElementById('start-btn').textContent = 'Stop';
            document.getElementById('start-btn').classList.add('active');
            loop();
        }).catch(function (err) {
            console.error('Mic access failed:', err);
        });
    }

    function stop() {
        running = false;
        if (engine) engine.stop();
        document.getElementById('start-btn').textContent = 'Start';
        document.getElementById('start-btn').classList.remove('active');
        ui.render(null);
    }

    var frame = 0;
    function loop() {
        if (!running) return;
        requestAnimationFrame(loop);
        frame++;

        // Level meter
        var level = core.getOverallLevel();
        var pct = Math.max(0, Math.min(100, ((level + 60) / 60) * 100));
        document.getElementById('level-bar').style.width = pct + '%';

        // DSP at ~30fps, render at 60fps
        if (frame % 2 === 0) core.process();
        ui.render(core);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
