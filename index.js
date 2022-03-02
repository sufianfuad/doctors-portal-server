const express = require('express')

const cors = require('cors')
//mongodb
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const admin = require("firebase-admin");
const fileUpload = require('express-fileupload');
require('dotenv').config();

//stripe
// const stripe = require('stripe')(process.env.STRIPE_SECRET)

const app = express();
const port = process.env.PORT || 5000;


const serviceAccount = require('./doctors-portal-firebase-adminsdk-p950s.json')
// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});


//middleWare
app.use(cors());
app.use(express.json());
app.use(fileUpload());

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
        const doctorsCollection = database.collection('doctors');

        app.get('/appointments', verifyToken, async (req, res) => {
            const email = req.query.email;
            // const date = new Date(req.query.date).toLocaleDateString();
            // console.log(date)
            console.log(query);
            const query = { email: email }
            const cursor = appointmentsCollection.find(query);
            const appointments = await cursor.toArray();
            res.json(appointments);
        });
        app.get('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await appointmentsCollection.findOne(query);
            res.json(result);
        })

        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentsCollection.insertOne(appointment)
            console.log(result)
            res.json(result)
            // res.json({ message: 'Hello' })
        });
        //update
        app.put('/appointments/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    payment: payment
                }
            }
            const result = await appointmentsCollection.updateOne(filter, updateDoc);
            res.json(result);
        });
        app.post('/doctors', async (req, res) => {
            console.log()
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
        app.post('/create-payment-intent', async (req, res) => {
            const paymentInfo = req.body;
            // aitar mane hocche poysha hishab kore
            const amount = paymentInfo.price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                payment_method_types: ['card']
            });
            res.json({ clientSecret: paymentIntent.client_secret });
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