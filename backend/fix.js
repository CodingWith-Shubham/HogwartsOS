import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

async function fix() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const EditingTask = mongoose.model('EditingTask', new mongoose.Schema({}, { strict: false }));
    const tasks = await EditingTask.find({});
    let count = 0;
    
    for (const task of tasks) {
        if (task.get('taskId') === 'TASK_1784794753429_1') {
            task.set('revisionCount', 1);
            await task.save();
            count++;
        }
    }
    
    console.log(`Fixed ${count} tasks`);
    process.exit(0);
}

fix().catch(console.error);
