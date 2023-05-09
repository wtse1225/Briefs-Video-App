var mongoose = require("mongoose")
var Schema = mongoose.Schema;
const bcrypt = require('bcryptjs')

var userSchema = new Schema({
    "username": {
        type: String,
        unique: true
    },
    "password": String,
    "email": String,
    "loginHistory": [{
        "dateTime": Date,
        "userAgent": String
    }]
})

let User; // to be defined on new connection (see initialize)

module.exports.initialize = function () {
    return new Promise(function (resolve, reject) {
        let db = mongoose.createConnection(process.env.MONGO_URI_STRING);

        db.on('error', (err)=>{
            reject(err); // reject the promise with the provided error
        });
        db.once('open', ()=>{
           User = db.model("users", userSchema);
           console.log("MONGO DB LOADED")
           resolve();
        });
    });
};


module.exports.registerUser = function(userData) {
    return new Promise((resolve, reject) => {
        if (userData.password != userData.password2) {
            reject("PASSWORDS DO NOT MATCH")
        } else {
            bcrypt.hash(userData.password, 10).then((hash) => {
                userData.password = hash
                let newUser = new User(userData)
                newUser.save().then(() => {
                    resolve()
                }).catch((err) => {
                    if(err.code == 11000) {
                        console.log("USERNAME TAKEN")
                        reject("USERNAME ALREADY TAKEN!")
                    } else {
                        reject(err)
                    }
                })
            }).catch((err) => {
                reject("PASSWORD ENCRYPTION ERROR")
            })

        }
    })
}

module.exports.loginUser = function(userData) {
    return new Promise((resolve, reject) => {
        User.findOne({username: userData.username})
        .exec()
        .then((user) => {
            if(!user) {
                reject("USER NOT FOUND!")
            } else {
                bcrypt.compare(userData.password, user.password).then((result) => {
                    if (result) {
                        user.loginHistory.push({dateTime: new Date(), userAgent: userData.userAgent})
                        User.updateOne(
                            {username: user.username},
                            {$set: {loginHistory: user.loginHistory}}
                        ).then(() => {
                            resolve(user)
                        }).catch((err) => {
                            reject("CANNOT UPDATE LOGIN HISTORY")
                        })
                    } else {
                        reject("INCORRECT PASSWORD")
                    }
                }).catch((err) => {
                    reject("PASSWORD COULD NOT BE DECRYPTED")
                })
                // if (userData.password == user.password) {
                //     resolve()
                // } else {
                //     console.log(userData.password, user.password)
                //     reject("INCORRECT PASSWORD!")
                // }
            }
        }).catch((err) => {
            reject("DATABASE ERROR")
            console.log(err)
        })
    })
}

