const express = require("express");
const cors = require("cors");
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const admin = require("firebase-admin");
const serviceAccount = require("./fireBaseToken.json");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const PORT = process.env.PORT || 5000;

//imageUpload
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(express.json());

// uri
const uri =
  "mongodb+srv://training-center:UXopq9bAnnEBBavq@cluster0.mlu0v9d.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
// MongoDB setup
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//firebase Access token validation copied from fb service account

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware to check for a valid access token

async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({
      ping: 1,
    });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    const db = client.db("training-center");

    // ------------------- Collections ------------------

    const usersCollection = db.collection("users");
    const productsCollection = db.collection("products");
    const ordersCollection = db.collection("orders");
    const tasksCollection = db.collection("tasks");
    const messagesCollection = db.collection("messages");
    const coursesCollection = db.collection("courses");
    // ------------------- Token Verify ------------------
    //verify fb Token
    const verifyToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "No token provided" });
      }
      const token = authHeader.split(" ")[1];
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded = decoded;
        next();
      } catch (err) {
        return res.send(401).send({ message: "unauthorized Access" });
      }
    };
    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const adminEmail = req.decoded.email;

      if (adminEmail) {
        const userFromDb = await usersCollection.findOne({ email: adminEmail });
        if (userFromDb.role === "admin") {
          next();
        } else {
          return res
            .status(403)
            .send({ message: "Forbidden: Requires administrator access." });
        }
      }
    };
    //verify member
    const verifyMember = async (req, res, next) => {
      const adminEmail = req.decoded.email;

      if (adminEmail) {
        const userFromDb = await usersCollection.findOne({ email: adminEmail });
        if (userFromDb.role === "member") {
          next();
        }
      } else {
        return res
          .status(403)
          .send({ message: "Forbidden: Requires member access." });
      }
    };

    // ------------------- ROUTES -------------------

    app.get("/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.json(users);
    });

    app.get("/products", async (req, res) => {
      const products = await productsCollection.find().toArray();
      res.json(products);
    });

    app.get("/orders", async (req, res) => {
      const orders = await ordersCollection.find().toArray();
      res.json(orders);
    });

    app.get("/tasks", async (req, res) => {
      const tasks = await tasksCollection.find().toArray();
      res.json(tasks);
    });

    app.get("/messages", async (req, res) => {
      const messages = await messagesCollection.find().toArray();
      res.json(messages);
    });
    // post user info to db after user finish registration
    app.post("/addUserInfo", async (req, res) => {
      try {
        const {
          instituteName,
          directorName,
          fatherName,
          motherName,
          email,
          mobileNumber,
          address,
          postOffice,
          upazila,
          district,
          username,
          password,
          directorPhoto,
          institutePhoto,
          nationalIdPhoto,
          signaturePhoto,
        } = req.body;

        const newUserInfo = {
          instituteName,
          directorName,
          fatherName,
          motherName,
          email,
          mobileNumber,
          address,
          postOffice,
          upazila,
          district,
          username,
          password,
          directorPhoto,
          institutePhoto,
          nationalIdPhoto,
          signaturePhoto,
          role: "member",
        };
        console.log(address);
        const result = await usersCollection.insertOne(newUserInfo);
        res.status(201).json({
          message: "User information added successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        console.error("Error adding user info:", error);
        res.status(500).json({
          message:
            "An error occurred while adding user information from registration form",
          error: error.message,
        });
      }
    });

    //get user info from db to show in the branch list
    app.get("/allUserInfo", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    //get all course data from db
    app.get("/allCourses", async (req, res) => {
      const result = await coursesCollection.find().toArray();
      res.send(result);
    });
    //get the total number of courses from db
    app.get("/numberOfCourses", async (req, res) => {
      const count = await coursesCollection.estimatedDocumentCount();
      res.send({ count });
    });
    // get currently logged in user info
    app.get("/currentUserInfo", async (req, res) => {
      const userEmail = req.query.email;
      console.log(userEmail);
      try {
        const currentUserData = await usersCollection.findOne({
          email: userEmail,
        });

        const data = { currentUserData };
        if (currentUserData) {
          res.status(200).send(data);
        } else {
          res.status(200).send({});
        }
      } catch (error) {
        console.error("Error fetching user agreement:", error);
        res
          .status(500)
          .send({ message: "Server error fetching user agreement." });
      }
    });
    //upload image to imageBB (DO NOT TOUCH)
    app.post("/upload-to-imgbb", upload.single("image"), async (req, res) => {
      try {
        const apiKey = process.env.IMGBB_API_KEY;
        if (!apiKey) {
          return res
            .status(500)
            .json({ error: "ImageBB API key is not configured." });
        }

        const file = req.file;
        if (!file) {
          return res.status(400).json({ error: "No image file provided." });
        }
        const formData = new FormData();
        formData.append("image", file.buffer, { filename: file.originalname });
        const imgbbResponse = await axios.post(
          `https://api.imgbb.com/1/upload?key=${apiKey}`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
          }
        );

        const imageUrl = imgbbResponse.data.data.url;
        res.status(200).json({ imageUrl }); 
      } catch (error) {
        res
          .status(500)
          .json({ error: "Failed to upload image. Please try again later." });
      }
    });
    //add course to the all course in db
    app.post('/addCourse',async(req,res)=>{
      const courseData = req.body
      console.log(courseData);
      const result = await coursesCollection.insertOne(courseData)
      res.status(201).json({ message: 'Course added successfully!', course: result });
    })

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } finally {
  }
}

run().catch(console.dir);
