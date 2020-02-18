const moment = require('moment');
const mongoose = require('mongoose');

/* Connect to database. */
mongoose.connect(
    process.env.MONGODB_URI || 'mongodb://localhost/exercise-track',
    {useNewUrlParser: true, useUnifiedTopology: true});

let userSchema = new mongoose.Schema({
    name : String
});

let userModel = mongoose.model('tracker_user', userSchema);

let logItemSchema = new mongoose.Schema({
    userid      : mongoose.ObjectId,
    description : String,
    duration    : Number,
    date        : Date
});

let logItemModel = mongoose.model('tracker_log', logItemSchema);

function createUser(username, next) {
    let user = new userModel({
        name : username
    });
    user.save(next);
}

module.exports.createUser = createUser;

function getUserByName(username, next) {
    userModel.findOne({name : username}, next);
}

module.exports.getUserByName = getUserByName;

function getAllUsers(next) {
    userModel.find({}, next);
}

module.exports.getAllUsers = getAllUsers;

function getUserById(userId, next) {
    userModel.findById(userId, next);
}

module.exports.getUserById = getUserById;

function addLogItem(userId, description, duration, date, next) {
    let itemMembers = {
        userid      : mongoose.Types.ObjectId(userId),
        description : description,
        duration    : duration
    };
    
    if(date !== undefined) {
        itemMembers.date = date;
    }
    
    let item = new logItemModel(itemMembers);
    item.save(next);
}

module.exports.addLogItem = addLogItem;

function getLogItems(userId, from, to, limit, next) {
    let filter      = {userid : userId};
    
    if(from || to) {
        let dateCondition = {};
        
        if(from) {
            dateCondition['$gte'] = moment(from).startOf('day').toDate();
        }
        
        if(to) {
            dateCondition['$lt'] = moment(to).endOf('day').toDate();
        }
        
        filter.date = dateCondition;
    }
    
    if(limit) {
        logItemModel.find(filter).limit(limit).exec(next);
    }
    else {
        logItemModel.find(filter, next);
    }
}

module.exports.getLogItems = getLogItems;
