class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterVolume = 0.5;
        this.enabled = true;

        // Sound profiles
        this.shotProfiles = {
            'Classic Blip': { freq: 800, decay: 0.1, type: 'sine' },
            'Soft Bell': { freq: 1200, decay: 0.3, type: 'triangle' },
            'Arcade Chip': { freq: 400, decay: 0.1, type: 'square' },
            'Wood Block': { freq: 300, decay: 0.05, type: 'sine' }
        };

        this.gruntProfiles = {
            'Sharp': { noise: 0.8, pitch: 150, decay: 0.2 },
            'Deep': { noise: 0.5, pitch: 80, decay: 0.4 },
            'Power': { noise: 1.0, pitch: 120, decay: 0.3 },
            'Funny Soft': { noise: 0.2, pitch: 200, decay: 0.1 }
        };
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    createReverb() {
        // Simple synthetic reverb using noise
        const length = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }
        const node = this.ctx.createConvolver();
        node.buffer = buffer;
        return node;
    }

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
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + decay);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume * this.masterVolume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + decay);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        source.start();
    }

    playShot(category, style) {
        const profile = this.shotProfiles[style] || this.shotProfiles['Classic Blip'];
        let freqMult = 1;

        switch (category) {
            case 'good': freqMult = 1.2; break;
            case 'fair': freqMult = 1.0; break;
            case 'short': freqMult = 0.5; break;
            case 'high': freqMult = 0.7; break;
        }

        this.playTone(profile.freq * freqMult, profile.type, profile.decay, 0.4);
    }

    playGrunt(style) {
        const profile = this.gruntProfiles[style] || this.gruntProfiles['Sharp'];

        // Grunt is a mix of tone and noise
        this.playTone(profile.pitch, 'triangle', profile.decay, profile.noise * 0.3);
        this.playNoise(profile.decay, profile.noise * 0.2, profile.pitch * 5);
    }

    playImpact() {
        this.playTone(150, 'sine', 0.05, 0.3);
    }

    playSmash() {
        this.playNoise(0.4, 0.6, 2000); // Aggressive white noise burst
    }
}

const audioManager = new AudioManager();
export default audioManager;
