const mongoose = require('mongoose');
mongoose.connect('mongodb://bhandarijee5672_db_user:os3AfkHdeA6tb3Jf@ac-5vnzdf3-shard-00-00.bnm7po2.mongodb.net:27017,ac-5vnzdf3-shard-00-01.bnm7po2.mongodb.net:27017,ac-5vnzdf3-shard-00-02.bnm7po2.mongodb.net:27017/test?ssl=true&replicaSet=atlas-e2bro3-shard-0&authSource=admin&appName=Cluster0').then(async () => {
    const EditingTask = mongoose.model('EditingTask', new mongoose.Schema({}, { strict: false }));
    const EditProject = mongoose.model('EditProject', new mongoose.Schema({}, { strict: false }));
    await EditingTask.updateMany({}, { $set: { managerComment: '' } });
    await EditProject.updateMany({}, { $set: { managerComment: '' } });
    console.log('Cleared manager comments');
    process.exit(0);
});
