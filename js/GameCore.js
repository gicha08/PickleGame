// Consolidated Game Logic to resolve loading issues

// --- AudioManager ---
class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterVolume = 1.0; // Boosted for mobile
        this.enabled = true;
        this.buffers = {};
        this._unlocked = false;

        // Define Audio Pools based on actual files in assets/sounds/
        this.pools = {
            'voice_good': [
                'Nice_Aaron(en_US).mp3',
                'Excellent_Whisper(en_US).mp3',
                'Great_Aaron(en_US).mp3',
                'Excellent_Aaron(en_US).mp3',
                'Good_Aaron(en_US).mp3',
                'Excellent_Bubble(en_US).mp3',
                'Excellent_Zarvox(en_US).mp3'
            ],
            'voice_fair': [
                'ItWorks_Aaron(en_US).mp3',
                'NotBad_Aaron(en_US).mp3',
                'Okay_Aaron(en_US).mp3',
                'NotBad_Samantha(en_US).mp3'
            ],
            'voice_short': [
                'TooWeak_Bubble(en_US).mp3',
                'ItsTooWeak_Aaron(en_US).mp3',
                'ItsTooShort_Aaron(en_US).mp3'
            ],
            'voice_smash': [
                'BOOM_Daniel(en_UK).mp3'
            ],
            'grunt_male': [
                'Grunt_male(1).mp3',
                'Grunt_male(2).mp3',
                'Grunt_male(3).mp3',
                'Grunt_male(4).mp3',
                'Grunt_male(5).mp3'
            ],
            'grunt_female': [
                'Grunt_female(1).mp3',
                'Grunt_female(2).mp3',
                'Grunt_female(3).mp3',
                'Grunt_female(4).mp3',
                'Grunt_female(5).mp3',
                'Grunt_female(6).mp3',
                'Grunt_female(7).mp3',
                'Grunt_female(8).mp3'
            ],
            'impact': ['paddle_hit.mp3', 'court_bounce.mp3']
        };

        this.paths = {
            'voice_good': 'assets/sounds/voices/good/',
            'voice_fair': 'assets/sounds/voices/fair/',
            'voice_short': 'assets/sounds/voices/short/',
            'voice_smash': 'assets/sounds/voices/smash/',
            'grunt_male': 'assets/sounds/grunts/male/',
            'grunt_female': 'assets/sounds/grunts/female/',
            'impact': 'assets/sounds/impacts/'
        };
    }

    init() {
        if (this._unlocked && this.ctx && this.ctx.state === 'running') return;

        const unlock = () => {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.preloadAll();
            }
            this.ctx.resume().then(() => {
                if (this.ctx.state === 'running') {
                    console.log('[AudioManager] UNLOCKED');
                    this._unlocked = true;
                    // Play a tiny beep to confirm
                    this.playTone(1000, 'sine', 0.01, 0.1);
                    window.removeEventListener('touchend', unlock);
                    window.removeEventListener('click', unlock);
                    window.removeEventListener('touchstart', unlock);
                }
            });
        };

        window.addEventListener('touchend', unlock, false);
        window.addEventListener('touchstart', unlock, false);
        window.addEventListener('click', unlock, false);
        unlock(); // Try immediate
    }

    async preloadAll() {
        console.log('[AudioManager] Preloading assets...');
        for (const [poolName, files] of Object.entries(this.pools)) {
            for (const file of files) {
                const url = this.paths[poolName] + file;
                this.loadSound(url);
            }
        }
    }

    async loadSound(url) {
        if (this.buffers[url]) return this.buffers[url];
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffers[url] = audioBuffer;
            return audioBuffer;
        } catch (e) { return null; }
    }

    playBuffer(buffer, volume = 0.5) {
        if (!this.enabled || !this.ctx || !buffer) return;
        if (this.ctx.state !== 'running') this.ctx.resume();
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume * this.masterVolume, this.ctx.currentTime);
        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(0);
    }

    playRandom(poolName, volume = 0.5) {
        if (!this.enabled || !this.ctx) return;
        if (this.ctx.state !== 'running') this.ctx.resume();
        const pool = this.pools[poolName];
        if (!pool) return;

        const file = pool[Math.floor(Math.random() * pool.length)];
        const url = this.paths[poolName] + file;

        if (this.buffers[url]) {
            this.playBuffer(this.buffers[url], volume);
        } else {
            this.playFallbackBeep(poolName);
            this.loadSound(url);
        }
    }

    playFallbackBeep(type) {
        // Keeps the game audible even before user adds all MP3s
        if (type.includes('good')) this.playTone(800, 'sine', 0.2, 0.3);
        else if (type.includes('fair')) this.playTone(400, 'sine', 0.1, 0.3);
        else if (type.includes('smash')) this.playNoise(0.4, 0.5, 2000);
        else if (type.includes('impact')) this.playTone(150, 'sine', 0.05, 0.2);
    }

    // Legacy support for synthesized tones
    playTone(freq, type, decay, volume = 0.5) {
        if (!this.enabled || !this.ctx) return;
        this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.1, this.ctx.currentTime + decay);
        gain.gain.setValueAtTime(volume * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + decay);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + decay);
    }

    playNoise(decay, volume = 0.5, filterFreq = 1000) {
        if (!this.enabled || !this.ctx) return;
        this.ctx.resume();
        const bufferSize = this.ctx.sampleRate * decay;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + decay);
        source.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
        source.start();
    }

    // Updated high-level methods
    playShot(category) {
        if (category === 'good') this.playRandom('voice_good', 0.8);
        else if (category === 'fair') this.playRandom('voice_fair', 0.7);
        else if (category === 'short') this.playRandom('voice_short', 0.7);
        else if (category === 'high') this.playSmash();
        else this.playFallbackBeep(category);
    }
    playGrunt(style) {
        const pool = style.toLowerCase().includes('female') ? 'grunt_female' : 'grunt_male';
        this.playRandom(pool, 0.5);
    }
    playImpact() { this.playRandom('impact', 0.4); }
    playSmash() { this.playRandom('voice_smash', 0.9); }
}
const audioManager = new AudioManager();

// --- SettingsManager ---
class SettingsManager {
    constructor() {
        this.settings = {
            soundEnabled: true,
            gruntEnabled: true,
            gruntStyle: 'Male', // Simplified to 'Male' or 'Female' pack
        };
        this.loadSettings();
    }
    loadSettings() {
        const saved = localStorage.getItem('pickleball_settings');
        if (saved) this.settings = JSON.parse(saved);
        this.applySettings();
    }
    saveSettings() {
        localStorage.setItem('pickleball_settings', JSON.stringify(this.settings));
        this.applySettings();
        this.updateUIStates();
    }
    applySettings() { audioManager.enabled = this.settings.soundEnabled; }

    initUI() {
        if (document.getElementById('settings-modal')) return;
        const modalHtml = `
            <div id="settings-modal" class="modal-overlay">
                <div class="modal-content glass">
                    <div class="modal-header">
                        <h2>Audio Setting</h2>
                        <button class="close-btn" onclick="settingsManager.toggleModal(false)">&times;</button>
                    </div>
                    
                    <div class="master-toggle-container">
                        <span class="master-toggle-label">USE SOUND EFFECTS</span>
                        <label class="switch large">
                            <input type="checkbox" id="master-sound-toggle" ${this.settings.soundEnabled ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                    </div>

                    <div id="settings-body" class="${this.settings.soundEnabled ? '' : 'disabled-area'}">
                        <div class="settings-section">
                            <h3>Voice Commentary</h3>
                            <div class="setting-row">
                                <label>Shot Feedback</label>
                                <span class="nav-value">Randomized Human Voice</span>
                            </div>
                            <p style="font-size: 11px; opacity: 0.6; margin-top: -5px;">Picks random MP3s from <b>/assets/sounds/voices/</b></p>
                        </div>

                        <div class="settings-section">
                            <h3>Player Grunts</h3>
                            <div class="setting-row grunt-row">
                                <div class="grunt-main">
                                    <input type="checkbox" id="grunt-toggle" ${this.settings.gruntEnabled ? 'checked' : ''}>
                                    <label for="grunt-toggle">I Grunt</label>
                                </div>
                                <div class="arrow-nav">
                                    <button class="nav-btn" onclick="settingsManager.navigateGrunt(-1)">◀</button>
                                    <span id="val-grunt" class="nav-value">${this.settings.gruntStyle}</span>
                                    <button class="nav-btn" onclick="settingsManager.navigateGrunt(1)">▶</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('master-sound-toggle').addEventListener('change', (e) => {
            this.settings.soundEnabled = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('grunt-toggle').addEventListener('change', (e) => {
            this.settings.gruntEnabled = e.target.checked;
            this.saveSettings();
        });
    }

    navigateGrunt(dir) {
        if (!this.settings.soundEnabled) return;
        const styles = ['Male', 'Female'];
        let idx = styles.indexOf(this.settings.gruntStyle);
        idx = (idx + dir + styles.length) % styles.length;
        const next = styles[idx];

        this.settings.gruntStyle = next;
        document.getElementById('val-grunt').innerText = next;
        audioManager.playGrunt(next);
        this.saveSettings();
    }

    updateUIStates() {
        const body = document.getElementById('settings-body');
        if (body) {
            body.className = this.settings.soundEnabled ? '' : 'disabled-area';
        }
    }

    toggleModal(show) {
        audioManager.init();
        const modal = document.getElementById('settings-modal');
        if (modal) modal.style.display = show ? 'flex' : 'none';
        if (show && typeof window.togglePause === 'function' && document.getElementById('toggle-pause-btn').getAttribute('data-state') === 'playing') window.togglePause();
    }
}
const settingsManager = new SettingsManager();
window.settingsManager = settingsManager;

// --- GameCore ---
(function () {
    const startApp = () => {
        if (typeof Ammo === 'function') {
            Ammo().then((instance) => { window.Ammo = instance; initGame(); });
        } else {
            initGame();
        }
    };

    if (typeof Ammo !== 'undefined') {
        startApp();
    } else {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(startApp, 10);
        } else {
            window.addEventListener('load', startApp);
        }
    }

    function initGame() {
        try {
            if (typeof Ammo !== 'undefined' && Ammo.btRigidBody && Ammo.btRigidBody.prototype && !Ammo.btRigidBody.prototype.setRollingFriction) {
                Ammo.btRigidBody.prototype.setRollingFriction = function () { };
                Ammo.btRigidBody.prototype.setSpinningFriction = function () { };
            }
            settingsManager.initUI();
            const canvas = document.getElementById('application');
            const app = new pc.Application(canvas, {
                mouse: new pc.Mouse(canvas), touch: new pc.TouchDevice(canvas),
                elementInput: new pc.ElementInput(canvas), keyboard: new pc.Keyboard(window)
            });
            app.start();
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);
            window.addEventListener('resize', () => app.resizeCanvas());

            const COURT_W = 6.1; const COURT_L = 13.41; const NET_H = 0.914; const BALL_R = 0.07;
            const light = new pc.Entity('DirectionalLight');
            light.addComponent('light', { type: 'directional', castShadows: true, intensity: 1.2, shadowBias: 0.2, normalOffsetBias: 0.05, shadowDistance: 20 });
            light.setLocalEulerAngles(45, 30, 0); app.root.addChild(light);
            const ambient = new pc.Entity('AmbientLight');
            ambient.addComponent('light', { type: 'point', color: new pc.Color(0.8, 0.8, 1), intensity: 0.5, range: 100 });
            ambient.setPosition(0, 10, 0); app.root.addChild(ambient);
            const camera = new pc.Entity('MainCamera');
            camera.addComponent('camera', { clearColor: new pc.Color(0.1, 0.11, 0.17), farClip: 100, fov: 60 });
            camera.setPosition(0, 2.5, 9); camera.lookAt(0, 0.8, 0); app.root.addChild(camera);

            const createMaterial = (color) => {
                const material = new pc.StandardMaterial();
                material.diffuse = color; material.update(); return material;
            };
            const matCourt = createMaterial(new pc.Color(0.14, 0.38, 0.54));
            const matLine = createMaterial(new pc.Color(1, 1, 1));
            const matNet = createMaterial(new pc.Color(1, 1, 1));
            matNet.opacity = 0.3; matNet.blendType = pc.BLEND_NORMAL; matNet.update();
            const matBall = createMaterial(new pc.Color(0.8, 1.0, 0));
            matBall.emissive = new pc.Color(0.2, 0.25, 0); matBall.update();
            const matPaddle = createMaterial(new pc.Color(0.9, 0.22, 0.27));
            const matDark = createMaterial(new pc.Color(0.1, 0.1, 0.1));

            const floor = new pc.Entity('Floor');
            floor.addComponent('render', { type: 'cylinder' });
            floor.setLocalScale(40, 0.1, 40); floor.setLocalPosition(0, -0.15, 0);
            floor.render.material = matDark; app.root.addChild(floor);

            const court = new pc.Entity('Court');
            court.addComponent('render', { type: 'plane' });
            court.setLocalScale(COURT_W, 1, COURT_L);
            court.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(COURT_W / 2, 0.1, COURT_L / 2) });
            court.addComponent('rigidbody', { type: 'static', friction: 0.1, restitution: 0.95 });
            court.render.material = matCourt; app.root.addChild(court);

            const addLine = (w, l, x, z) => {
                const ln = new pc.Entity(); ln.addComponent('render', { type: 'plane' });
                ln.setLocalScale(w, 1, l); ln.setLocalPosition(x, 0.01, z);
                ln.render.material = matLine; app.root.addChild(ln);
            };
            addLine(COURT_W, 0.05, 0, COURT_L / 2); addLine(COURT_W, 0.05, 0, -COURT_L / 2);
            addLine(0.05, COURT_L, COURT_W / 2, 0); addLine(0.05, COURT_L, -COURT_W / 2, 0);
            addLine(COURT_W, 0.05, 0, 2.13); addLine(COURT_W, 0.05, 0, -2.13);
            addLine(0.05, COURT_L - 4.26, 0, 0);

            const net = new pc.Entity('Net');
            const netVis = new pc.Entity('NetVis'); netVis.addComponent('render', { type: 'box' });
            netVis.setLocalScale(COURT_W + 0.4, NET_H, 0.02); netVis.setLocalPosition(0, NET_H / 2, 0);
            netVis.render.material = matNet; net.addChild(netVis);
            const tape = new pc.Entity('Tape'); tape.addComponent('render', { type: 'box' });
            tape.setLocalScale(COURT_W + 0.4, 0.05, 0.05); tape.setLocalPosition(0, NET_H, 0);
            tape.render.material = matLine; net.addChild(tape);
            const postL = new pc.Entity('PostL'); postL.addComponent('render', { type: 'cylinder' });
            postL.setLocalScale(0.08, NET_H + 0.1, 0.08); postL.setLocalPosition(-(COURT_W / 2 + 0.2), NET_H / 2, 0);
            postL.render.material = matDark; net.addChild(postL);
            const postR = new pc.Entity('PostR'); postR.addComponent('render', { type: 'cylinder' });
            postR.setLocalScale(0.08, NET_H + 0.1, 0.08); postR.setLocalPosition(COURT_W / 2 + 0.2, NET_H / 2, 0);
            postR.render.material = matDark; net.addChild(postR);
            net.setLocalPosition(0, 0, 0); app.root.addChild(net);
            const netCol = new pc.Entity('NetCol');
            netCol.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(COURT_W / 2 + 0.2, NET_H / 2, 0.05) });
            netCol.addComponent('rigidbody', { type: 'static' }); netCol.setLocalPosition(0, NET_H / 2, 0);
            app.root.addChild(netCol);

            // Muscular Opponent
            const matSkin = createMaterial(new pc.Color(0.85, 0.65, 0.5));
            const matShirt = createMaterial(new pc.Color(0.2, 0.4, 0.8));
            const matShorts = createMaterial(new pc.Color(0.15, 0.15, 0.15));
            const matShoe = createMaterial(new pc.Color(1, 1, 1));
            const matHeadband = createMaterial(new pc.Color(0.9, 0.1, 0.1));

            const opponent = new pc.Entity('Opponent'); opponent.setLocalPosition(0, 0, -2.13);
            const torso = new pc.Entity(); torso.addComponent('render', { type: 'box' });
            torso.setLocalScale(0.6, 0.7, 0.35); torso.setLocalPosition(0, 1.3, 0);
            torso.render.material = matShirt; opponent.addChild(torso);
            const neck = new pc.Entity(); neck.addComponent('render', { type: 'cylinder' });
            neck.setLocalScale(0.15, 0.14, 0.15); neck.setLocalPosition(0, 1.72, 0);
            neck.render.material = matSkin; opponent.addChild(neck);
            const head = new pc.Entity(); head.addComponent('render', { type: 'sphere' });
            head.setLocalScale(0.28, 0.3, 0.28); head.setLocalPosition(0, 1.88, 0);
            head.render.material = matSkin; opponent.addChild(head);
            const headband = new pc.Entity(); headband.addComponent('render', { type: 'cylinder' });
            headband.setLocalScale(0.3, 0.06, 0.3); headband.setLocalPosition(0, 1.92, 0);
            headband.render.material = matHeadband; opponent.addChild(headband);
            const shorts = new pc.Entity(); shorts.addComponent('render', { type: 'box' });
            shorts.setLocalScale(0.55, 0.28, 0.32); shorts.setLocalPosition(0, 0.88, 0);
            shorts.render.material = matShorts; opponent.addChild(shorts);

            const addLeg = (xOff) => {
                const thigh = new pc.Entity(); thigh.addComponent('render', { type: 'box' });
                thigh.setLocalScale(0.18, 0.38, 0.18); thigh.setLocalPosition(xOff, 0.56, 0);
                thigh.render.material = matSkin; opponent.addChild(thigh);
                const calf = new pc.Entity(); calf.addComponent('render', { type: 'box' });
                calf.setLocalScale(0.16, 0.34, 0.16); calf.setLocalPosition(xOff, 0.26, 0);
                calf.render.material = matSkin; opponent.addChild(calf);
                const shoe = new pc.Entity(); shoe.addComponent('render', { type: 'box' });
                shoe.setLocalScale(0.17, 0.1, 0.24); shoe.setLocalPosition(xOff, 0.07, 0.05);
                shoe.render.material = matShoe; opponent.addChild(shoe);
            };
            addLeg(-0.15); addLeg(0.15);
            const oppArmL = new pc.Entity(); oppArmL.addComponent('render', { type: 'box' });
            oppArmL.setLocalScale(0.14, 0.7, 0.14); oppArmL.setLocalPosition(-0.42, 1.0, 0.05);
            oppArmL.setLocalEulerAngles(10, 0, 15); oppArmL.render.material = matSkin; opponent.addChild(oppArmL);
            const oppArmR = new pc.Entity(); oppArmR.addComponent('render', { type: 'box' });
            oppArmR.setLocalScale(0.16, 0.75, 0.16); oppArmR.setLocalPosition(0.42, 1.0, 0);
            oppArmR.setLocalEulerAngles(0, 0, -20); oppArmR.render.material = matSkin; opponent.addChild(oppArmR);
            const oppPaddle = new pc.Entity(); oppPaddle.addComponent('render', { type: 'box' });
            oppPaddle.setLocalScale(0.22, 0.35, 0.02); oppPaddle.setLocalPosition(-0.5, 1.4, 0.18);
            oppPaddle.setLocalEulerAngles(15, 0, 10); oppPaddle.render.material = matPaddle; opponent.addChild(oppPaddle);
            app.root.addChild(opponent);

            let smashAnimT = -1; const SMASH_DURATION = 0.25;
            const oppArmRestPos = new pc.Vec3(0.42, 1.0, 0); const oppArmRestRot = new pc.Vec3(0, 0, -20);
            const oppPaddleRestPos = new pc.Vec3(-0.5, 1.4, 0.18); const oppPaddleRestRot = new pc.Vec3(15, 0, 10);

            // Ball & Paddle
            const ball = new pc.Entity('Ball'); ball.addComponent('render', { type: 'sphere' });
            ball.render.material = matBall; ball.setLocalScale(BALL_R * 2, BALL_R * 2, BALL_R * 2);
            ball.addComponent('collision', { type: 'sphere', radius: BALL_R });
            ball.addComponent('rigidbody', { type: 'dynamic', mass: 0.026, restitution: 0.8, linearDamping: 0.1, angularDamping: 0.1 });
            ball.enabled = false; app.root.addChild(ball);
            const paddle = new pc.Entity('Paddle');
            const pVis = new pc.Entity(); pVis.addComponent('render', { type: 'box' });
            pVis.setLocalScale(0.22, 0.38, 0.02); pVis.render.material = matPaddle; paddle.addChild(pVis);
            const pHandle = new pc.Entity(); pHandle.addComponent('render', { type: 'cylinder' });
            pHandle.setLocalScale(0.04, 0.15, 0.04); pHandle.setLocalPosition(0, -0.26, 0);
            pHandle.render.material = matDark; paddle.addChild(pHandle);
            paddle.addComponent('collision', { type: 'box', halfExtents: new pc.Vec3(0.5, 0.4, 0.1) });
            paddle.addComponent('rigidbody', { type: 'kinematic' }); paddle.enabled = false;
            app.root.addChild(paddle);

            let gameState = 'IDLE'; let ballHasBounced = false; let playerHasHit = false;
            let goodDrops = 0, fairDrops = 0, shortBalls = 0, highBalls = 0;
            let oppTargetX = 0; let smashSize = 1.0;
            const msgEl = document.getElementById('message');
            const showMsg = (txt, type = '', stay = false) => {
                if (!msgEl) return;
                msgEl.innerText = txt; msgEl.className = type; msgEl.offsetHeight; msgEl.classList.add('show');
                if (type) audioManager.playShot(type);
                if (!stay) setTimeout(() => msgEl.classList.remove('show'), 1500);
            };
            const updateUI = () => {
                document.getElementById('good-score').innerText = goodDrops;
                document.getElementById('fair-score').innerText = fairDrops;
                document.getElementById('short-score').innerText = shortBalls;
                document.getElementById('high-score').innerText = highBalls;
            };
            const resetBall = () => {
                ball.rigidbody.teleport(0, 10, 0); ball.rigidbody.linearVelocity = pc.Vec3.ZERO;
                ball.enabled = false; playerHasHit = false; ballHasBounced = false; smashSize = 1.0;
            };
            const serve = () => {
                if (msgEl) msgEl.classList.remove('show');
                gameState = 'PLAY'; playerHasHit = false; ball.enabled = true;
                opponent.setPosition(0, 0, -2.13); oppTargetX = 0;
                ball.rigidbody.teleport(0, 1.3, -2.13); ball.rigidbody.activate();
                ball.rigidbody.linearVelocity = new pc.Vec3((Math.random() - 0.5) * 0.5, 3 + Math.random() * 1, 7 + Math.random() * 2);
            };
            const opponentSmash = () => {
                gameState = 'RETURN'; smashAnimT = 0;
                const oppPos = opponent.getPosition();
                ball.rigidbody.teleport(oppPos.x - 0.5, 1.5, oppPos.z + 0.2);
                ball.rigidbody.activate();
                audioManager.playSmash();
                setTimeout(() => {
                    if (gameState !== 'RETURN') return;
                    ball.rigidbody.activate();
                    ball.rigidbody.linearVelocity = new pc.Vec3((Math.random() - 0.5) * 5, -10 + Math.random() * 5, 30 + Math.random() * 10);
                    smashSize = 2.5;
                }, 100);
            };
            window.togglePause = () => {
                app.timeScale = app.timeScale === 1 ? 0 : 1;
                document.getElementById('toggle-pause-btn').setAttribute('data-state', app.timeScale === 0 ? 'paused' : 'playing');
            };
            window.restartGame = () => {
                goodDrops = 0; fairDrops = 0; shortBalls = 0; highBalls = 0; updateUI();
                app.timeScale = 1; gameState = 'IDLE'; resetBall();
                setTimeout(() => { if (gameState === 'IDLE') serve(); }, 500);
                showMsg('RESTARTED', 'short');
            };

            let isSwiping = false;
            let swipeStart = { x: 0, y: 0, t: 0 };

            window.addEventListener('pointerdown', (e) => {
                if (e.target.closest('.side-btn') || e.target.closest('.modal-content')) return;
                audioManager.init(); paddle.enabled = true;
                if (gameState === 'IDLE') serve();
                else if (gameState === 'PLAY') {
                    isSwiping = true;
                    swipeStart = { x: e.clientX, y: e.clientY, t: performance.now() };
                }
            });

            window.addEventListener('pointerup', (e) => {
                paddle.enabled = false;
                if (!isSwiping || gameState !== 'PLAY') return;
                isSwiping = false;
                const dt = (performance.now() - swipeStart.t) / 1000;
                const dx = e.clientX - swipeStart.x;
                const dy = swipeStart.y - e.clientY;
                const bPos = ball.getPosition();
                if (bPos.z > 0 && bPos.y > -0.5) {
                    playerHasHit = true; audioManager.playImpact();
                    if (settingsManager.settings.gruntEnabled) audioManager.playGrunt(settingsManager.settings.gruntStyle);
                    const speed = Math.sqrt(dx * dx + dy * dy) / Math.max(dt, 0.01);
                    const intensity = Math.min(1, Math.max(0, (speed - 50) / 1200));
                    ball.rigidbody.activate();
                    ball.rigidbody.linearVelocity = new pc.Vec3(dx / window.innerWidth * 6, Math.min(4 + intensity * 6, 10), -Math.min(6 + intensity * 8, 15));
                }
            });

            window.addEventListener('pointermove', (e) => {
                const start = new pc.Vec3(), end = new pc.Vec3();
                camera.camera.screenToWorld(e.clientX, e.clientY, 0.1, start);
                camera.camera.screenToWorld(e.clientX, e.clientY, 100, end);
                const rayDir = end.sub(start).normalize();
                const t = (6.5 - start.z) / rayDir.z;
                if (t > 0) {
                    const hit = start.add(rayDir.scale(t));
                    paddle.rigidbody.teleport(pc.math.clamp(hit.x, -3.5, 3.5), pc.math.clamp(hit.y, 0.2, 2.5), 6.5);
                    paddle.setLocalEulerAngles(-10 + hit.y * 5, hit.x * 10, 0);
                }
            });

            const endRound = () => {
                gameState = 'IDLE'; resetBall();
                setTimeout(() => { if (gameState === 'IDLE') serve(); }, 1200);
            };

            app.on('update', (dt) => {
                const bPos = ball.getPosition(); const bVel = ball.rigidbody.linearVelocity;
                if (smashAnimT >= 0) {
                    smashAnimT += dt; const t = Math.min(smashAnimT / SMASH_DURATION, 1);
                    if (t < 0.3) {
                        const w = t / 0.3;
                        oppArmR.setLocalPosition(oppArmRestPos.x, oppArmRestPos.y + w * 0.6, oppArmRestPos.z - w * 0.4);
                        oppArmR.setLocalEulerAngles(oppArmRestRot.x - 90 * w, oppArmRestRot.y, oppArmRestRot.z + 30 * w);
                        oppPaddle.setLocalPosition(oppPaddleRestPos.x, oppPaddleRestPos.y + w * 0.7, oppPaddleRestPos.z - w * 0.5);
                        oppPaddle.setLocalEulerAngles(oppPaddleRestRot.x - 110 * w, oppPaddleRestRot.y, oppPaddleRestRot.z + 15 * w);
                    } else {
                        const s = (t - 0.3) / 0.7; const ease = 1 - Math.pow(1 - s, 2);
                        oppArmR.setLocalPosition(oppArmRestPos.x, oppArmRestPos.y + 0.6 - ease * 0.8, oppArmRestPos.z - 0.4 + ease * 0.7);
                        oppArmR.setLocalEulerAngles(oppArmRestRot.x - 90 + ease * 130, oppArmRestRot.y, oppArmRestRot.z + 30 - ease * 30);
                        oppPaddle.setLocalPosition(oppPaddleRestPos.x, oppPaddleRestPos.y + 0.7 - ease * 0.9, oppPaddleRestPos.z - 0.5 + ease * 0.8);
                        oppPaddle.setLocalEulerAngles(oppPaddleRestRot.x - 110 + ease * 140, oppPaddleRestRot.y, oppPaddleRestRot.z + 15 - ease * 20);
                    }
                    if (t >= 1) {
                        smashAnimT = -1; oppArmR.setLocalPosition(oppArmRestPos.x, oppArmRestPos.y, oppArmRestPos.z);
                        oppArmR.setLocalEulerAngles(oppArmRestRot.x, oppArmRestRot.y, oppArmRestRot.z);
                        oppPaddle.setLocalPosition(oppPaddleRestPos.x, oppPaddleRestPos.y, oppPaddleRestPos.z);
                        oppPaddle.setLocalEulerAngles(oppPaddleRestRot.x, oppPaddleRestRot.y, oppPaddleRestRot.z);
                    }
                }
                if (ball.enabled) {
                    if (bVel.z < 0) oppTargetX = bPos.x;
                    const oppPos = opponent.getPosition(); const dx = oppTargetX - oppPos.x;
                    const moveX = Math.sign(dx) * Math.min(Math.abs(dx), 6 * dt);
                    opponent.setPosition(pc.math.clamp(oppPos.x + moveX, -COURT_W / 2 + 0.3, COURT_W / 2 - 0.3), 0, -2.13);
                }
                if ((gameState === 'PLAY' || gameState === 'RETURN') && ball.enabled) {
                    if (smashSize > 1.0) smashSize -= dt * 0.5;
                    const scale = (1 + pc.math.clamp((bPos.z + 7) / 14, 0, 1) * 0.8) * smashSize;
                    ball.setLocalScale(BALL_R * 2 * scale, BALL_R * 2 * scale, BALL_R * 2 * scale);
                    if (playerHasHit && gameState === 'PLAY') {
                        if (bPos.z > 0.2 && bPos.y < 0.25 && bVel.y < 0 || (bPos.z > 0.5 && bVel.z > 2)) {
                            shortBalls++; updateUI(); showMsg('SHORT!', 'short'); endRound(); return;
                        }
                        if (bPos.z < -0.3) {
                            const hitGround = (bPos.y < 0.25 && bVel.y < 0); const reachedOpponent = (bPos.z <= -2.1);
                            if ((hitGround || reachedOpponent) && !ballHasBounced) {
                                ballHasBounced = true; const h = bPos.y;
                                if (h < 0.8) { goodDrops++; showMsg('GOOD DROP!', 'good'); }
                                else if (h < 1.4) { fairDrops++; showMsg('FAIR DROP!', 'fair'); }
                                else {
                                    highBalls++; showMsg('HIGH BALL!', 'high');
                                    if (reachedOpponent) { opponent.setPosition(bPos.x + 0.5, 0, -2.13); opponentSmash(); playerHasHit = false; updateUI(); return; }
                                }
                                updateUI(); endRound(); return;
                            }
                        }
                    }
                    if (Math.abs(bPos.z) > 12 || bPos.y < -0.5) endRound();
                }
            });
            showMsg('Click to Start', '', true);
        } catch (e) {
            console.error('Core error:', e);
            document.getElementById('message').innerText = "Init Error: " + e.message;
            document.getElementById('message').classList.add('show');
        }
    }
})();

