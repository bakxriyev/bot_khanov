import fs from 'fs';
import path from 'path';

// Data storage file path
const DATA_FILE = path.join(process.cwd(), 'user-data.json');

// Load user data from file
export function loadUserData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
    
    // Return empty data if file doesn't exist or there's an error
    return {
        userPhoneNumbers: {},
        userStates: {},
        userReminders: {},
        paymentConfirmations: {},
        userIds: {}
    };
}

// Save user data to file
export function saveUserData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving user data:', error);
    }
}