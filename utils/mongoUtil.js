const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()

let _db
const connectDB = async (callback) => {
   try {
       MongoClient.connect(process.env.MONGODB_URI,
        { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 },
          (err, db) => {
           _db = db
           return callback(err)
       })
   } catch (e) {
       throw e
   }
}

const disconnectDB = () => {
  _db.close()
}

const checkDB = () => {
  return _db;
}

const getCollection = (name) =>  _db.db('presenziin').collection(name);

module.exports = { connectDB, checkDB, getCollection, disconnectDB }
