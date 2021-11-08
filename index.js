const express = require('express')

const cors = require('cors')
//mongodb
const { MongoClient } = require('mongodb');

const admin = require("firebase-admin");

require('dotenv').config();


const app = express();
const port = process.env.PORT || 5000;

// doctors-portal-firebase-adminsdk-p950s.json

const serviceAccount = require('./doctors-portal-firebase-adminsdk-p950s.json')
// const serviceAccount = JSON.parse()

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


//middleWare
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.i3fcr.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {

    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }
    }
    next();
}

async function run() {
    try {
        await client.connect()
        const database = client.db('doctors_portal')
        const appointmentsCollection = database.collection('appointments');
        const usersCollection = database.collection('users');

        app.get('/appointments', verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            // console.log(date)
            const query = { email: email, date: date }
            const cursor = appointmentsCollection.find(query);
            const appointments = await cursor.toArray();
            res.json(appointments);
        })

        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment)
            console.log(result)
            res.json(result)
            // res.json({ message: 'Hello' })
        })
        //for special user like admin
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })
        // for user 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.json(result);
        });
        //for update user
        app.put('/users', async (req, res) => {
            const user = req.body;
            //filter email 
            const filter = { email: user?.email };
            //==
            const options = { upsert: true };
            //==
            const updateDoc = { $set: user };
            //==
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });
        // verified admin user
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            console.log('put', req.decodedEmail)

            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };

                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' });
            }


        })
    }
    finally {
        // await client.close()
    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello Doctors Portal!')
})

app.listen(port, () => {
    console.log('Doctor portal server', port)
})