const mongoose = require('mongoose');

mongoose.connect('mongodb://bhandarijee5672_db_user:os3AfkHdeA6tb3Jf@ac-5vnzdf3-shard-00-00.bnm7po2.mongodb.net:27017,ac-5vnzdf3-shard-00-01.bnm7po2.mongodb.net:27017,ac-5vnzdf3-shard-00-02.bnm7po2.mongodb.net:27017/test?ssl=true&replicaSet=atlas-e2bro3-shard-0&authSource=admin&appName=Cluster0').then(async () => {
    const EditingTask = mongoose.model('EditingTask', new mongoose.Schema({}, { strict: false }));
    
    // Group all tasks by shootId and taskType
    const tasks = await EditingTask.find().sort({ createdAt: 1 });
    
    const counters = {};
    for (const task of tasks) {
        if (!task.taskLabel || !task.shootId || !task.taskType) continue;
        
        const key = `${task.shootId}_${task.taskType}`;
        if (counters[key] === undefined) {
            counters[key] = 1;
        } else {
            counters[key]++;
        }
        
        if (task.taskLabel.endsWith('#1') && counters[key] > 1) {
            const newLabel = task.taskLabel.replace(/#1$/, `#${counters[key]}`);
            await EditingTask.updateOne({ _id: task._id }, { $set: { taskLabel: newLabel } });
            console.log(`Updated ${task.taskLabel} -> ${newLabel}`);
        }
    }
    
    console.log('Finished updating existing task labels!');
    process.exit(0);
});
