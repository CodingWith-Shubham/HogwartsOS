require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI).then(async () => {
    const EditingTask = mongoose.model('EditingTask', new mongoose.Schema({}, { strict: false }));
    const EditProject = mongoose.model('EditProject', new mongoose.Schema({}, { strict: false }));
    await EditingTask.updateMany({}, { $set: { managerComment: '' } });
    await EditProject.updateMany({}, { $set: { managerComment: '' } });
    console.log('Cleared manager comments');
    process.exit(0);
});
