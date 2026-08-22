import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedMaintenance = null;
let lastCheck = 0;

export const maintenanceMiddleware = (req, res, next) => {
    const now = Date.now();
    // Cache for 10 seconds to avoid hitting the disk on every request
    if (now - lastCheck > 10000) {
        try {
            const maintenancePath = path.join(__dirname, '../../maintenance.json');
            if (fs.existsSync(maintenancePath)) {
                const data = fs.readFileSync(maintenancePath, 'utf-8');
                cachedMaintenance = JSON.parse(data);
            } else {
                cachedMaintenance = null;
            }
        } catch (error) {
            console.error("Error reading maintenance.json:", error);
        }
        lastCheck = now;
    }

    if (cachedMaintenance && cachedMaintenance.isMaintenance) {
        return res.status(503).json({
            success: false,
            message: "Server is under maintenance",
            reason: cachedMaintenance.reason || "We'll be back shortly."
        });
    }

    next();
};
