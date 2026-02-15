import audioManager from './AudioManager.js';

class SettingsManager {
    constructor() {
        this.settings = {
            soundEnabled: true,
            gruntEnabled: true,
            gruntStyle: 'Sharp',
            shotSounds: {
                good: 'Soft Bell',
                fair: 'Classic Blip',
                short: 'Wood Block',
                high: 'Arcade Chip'
            }
        };

        this.loadSettings();
    }

    loadSettings() {
        const saved = localStorage.getItem('pickleball_settings');
        if (saved) {
            this.settings = JSON.parse(saved);
        }
        this.applySettings();
    }

    saveSettings() {
        localStorage.setItem('pickleball_settings', JSON.stringify(this.settings));
        this.applySettings();
    }

    applySettings() {
        audioManager.enabled = this.settings.soundEnabled;
    }

    initUI() {
        // Create Modal HTML
        const modalHtml = `
            <div id="settings-modal" class="modal-overlay">
                <div class="modal-content glass">
                    <div class="modal-header">
                        <h2>Game Settings</h2>
                        <button class="close-btn" onclick="settingsManager.toggleModal(false)">&times;</button>
                    </div>
                    
                    <div class="settings-section">
                        <h3>Master Control</h3>
                        <div class="setting-row">
                            <label>Sound Effects</label>
                            <label class="switch">
                                <input type="checkbox" id="master-sound-toggle" ${this.settings.soundEnabled ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h3>Shot Sounds</h3>
                        ${this.renderShotRow('Good Drop', 'good')}
                        ${this.renderShotRow('Fair Drop', 'fair')}
                        ${this.renderShotRow('Too Short', 'short')}
                        ${this.renderShotRow('High Ball', 'high')}
                    </div>

                    <div class="settings-section">
                        <h3>Player Grunts</h3>
                        <div class="setting-row">
                            <label>I Grunt!</label>
                            <label class="switch">
                                <input type="checkbox" id="grunt-toggle" ${this.settings.gruntEnabled ? 'checked' : ''}>
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="setting-row">
                            <label>Grunt Style</label>
                            <div>
                                <select id="grunt-style-select">
                                    ${Object.keys(audioManager.gruntProfiles).map(s => `<option value="${s}" ${this.settings.gruntStyle === s ? 'selected' : ''}>${s}</option>`).join('')}
                                </select>
                                <button class="test-sound-btn" onclick="settingsManager.testGrunt()">Test</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Bind events
        document.getElementById('master-sound-toggle').addEventListener('change', (e) => {
            this.settings.soundEnabled = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('grunt-toggle').addEventListener('change', (e) => {
            this.settings.gruntEnabled = e.target.checked;
            this.saveSettings();
        });

        document.getElementById('grunt-style-select').addEventListener('change', (e) => {
            this.settings.gruntStyle = e.target.value;
            this.saveSettings();
        });

        // Bind shot sound selects
        ['good', 'fair', 'short', 'high'].forEach(cat => {
            document.getElementById(`sound-${cat}-select`).addEventListener('change', (e) => {
                this.settings.shotSounds[cat] = e.target.value;
                this.saveSettings();
            });
        });
    }

    renderShotRow(label, key) {
        const options = Object.keys(audioManager.shotProfiles).map(s =>
            `<option value="${s}" ${this.settings.shotSounds[key] === s ? 'selected' : ''}>${s}</option>`
        ).join('');

        return `
            <div class="setting-row">
                <label>${label}</label>
                <div>
                    <select id="sound-${key}-select">
                        ${options}
                    </select>
                    <button class="test-sound-btn" onclick="settingsManager.testShot('${key}')">Test</button>
                </div>
            </div>
        `;
    }

    toggleModal(show) {
        audioManager.init(); // Initialize audio context on first user interaction
        const modal = document.getElementById('settings-modal');
        modal.style.display = show ? 'flex' : 'none';

        // Pause game when opening settings
        if (show && typeof window.togglePause === 'function' && document.getElementById('toggle-pause-btn').getAttribute('data-state') === 'playing') {
            window.togglePause();
        }
    }

    testShot(category) {
        audioManager.init();
        audioManager.playShot(category, this.settings.shotSounds[category]);
    }

    testGrunt() {
        audioManager.init();
        audioManager.playGrunt(this.settings.gruntStyle);
    }
}

const settingsManager = new SettingsManager();
window.settingsManager = settingsManager; // Expose for HTML onclicks
export default settingsManager;
