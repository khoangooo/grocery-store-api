var http = require("http");
var express = require("express");
var mongoClient = require("mongodb").MongoClient;
// var url = "mongodb://admin:admin@103.172.238.204:27017/";
var cors = require("cors");
var app = express();
var crypto = require("crypto");
app.use(cors());
const path = require("path");
const publicDirectoryPath = path.join(__dirname, "/public");
app.use(express.static(publicDirectoryPath));
var multer = require("multer");

const { MongoClient, ServerApiVersion } = require('mongodb');
const url = "mongodb+srv://demoMongoDB:admin@demo-mongodb.izjqv.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

client.connect(err => {
  const collection = client.db("DoAn").collection("Products");
  // perform actions on the collection object

  client.close();
});

const uploadAvatarStorage = multer.diskStorage({
  destination: "public/avatar/",
  filename: function (req, file, cb) {
    cb(
      null,
      crypto
        .createHash("md5")
        .update(file.originalname + Date.now().toString())
        .digest("hex") +
      "." +
      file.originalname.split(".")[1]
    );
  },
});
const uploadAvatar = multer({
  storage: uploadAvatarStorage,
});
const uploadProductStorage = multer.diskStorage({
  destination: "public/images/",
  filename: function (req, file, cb) {
    cb(
      null,
      crypto
        .createHash("md5")
        .update(file.originalname + Date.now().toString())
        .digest("hex") +
      "." +
      file.originalname.split(".")[1]
    );
  },
});
const uploadProduct = multer({
  storage: uploadProductStorage,
});
app.use(express.static("public"));
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
const bcrypt = require("bcrypt");
const { ObjectId } = require("mongodb");
const { ObjectID } = require("bson");
const saltRounds = 10;
const { body, validationResult } = require("express-validator");
const { format } = require("path");

app.get("/products", async function (req, res, next) {
  const client = await mongoClient.connect(url);
  const db = client.db("DoAn");
  const search = req.query.search;
  const kind = req.query.kind;
  const star = req.query.star;
  const discount = req.query.discount;
  const priceFrom = req.query.price_from;
  const priceTo = req.query.price_to;
  let sort = "name";
  let order = 1;
  let limit = 0;
  let offset = 0;
  let params = [];
  let query = {};
  let total = 0;
  let data;
  if (search !== undefined && search !== "") {
    params.push({
      $or: [
        { name: new RegExp(req.query.search, "i") },
        // { description: new RegExp(req.query.search, "i") },
      ],
    });
  }
  if (star !== undefined && star !== "") {
    params.push({ star: parseInt(req.query.star, 10) });
  }
  if (discount !== undefined && discount !== "" && discount === "true") {
    params.push({ discount: { $gt: 0 } });
  }
  if (priceFrom !== undefined && priceFrom !== "") {
    // params.push({ price: { $gte: parseInt(priceFrom, 10) } });
    params.push({  "$expr": { $gte: [{$multiply: ["$price", { $subtract: [1, "$discount"] }]}, parseInt(priceFrom, 10)] } });
  }
  if (priceTo !== undefined && priceTo !== "") {
    // params.push({ price: { $lte: parseInt(priceTo, 10) } });
    params.push({  "$expr": { $lte: [{$multiply: ["$price", { $subtract: [1, "$discount"] }]}, parseInt(priceTo, 10)] } });
  }
  if (req.query.sort !== undefined && req.query.sort !== "") {
    if (req.query.sort === "price") sort = "discounted_price";
    else sort = req.query.sort;
  }
  if (req.query.order !== undefined && req.query.order !== "") {
    if (req.query.order === "desc") order = -1;
  }
  if (req.query.limit !== undefined && req.query.limit !== "") {
    limit = parseInt(req.query.limit);
    if (isNaN(limit)) limit = 0;
  }
  if (req.query.offset !== undefined && req.query.offset !== "") {
    offset = parseInt(req.query.offset, 10);
    if (isNaN(offset)) offset = 0;
  }
  if (kind !== undefined && kind !== "") {
    let category;
    try {
      category = await db.collection("Categories").findOne({ name: kind });
    } catch (error) {
      res.status(500).send({
        status: 500,
        message: error.message || "Database error.",
        data: {
          data: null,
          total: total,
          limit: limit,
          offset: offset,
        },
      });
      return;
    }
    if (category) params.push({ kind: category.kind });
  }
  if (params.length > 0) query = { $and: params };
  const productsCollection = db.collection("Products");

  try {
    data =
      limit > 0
        ? await productsCollection
          .aggregate()
          .project({
            _id: 0,
            name: 1,
            price: 1,
            discount: 1,
            kind: 1,
            star: 1,
            description: 1,
            uid: 1,
            image: 1,
            discounted_price: {
              $cond: [
                { $gt: ["$discount", 0] },
                { $multiply: ["$price", { $subtract: [1, "$discount"] }] },
                "$price",
              ],
            },
          })
          .match(query)
          .sort({ [sort]: order })
          .skip(offset)
          .limit(limit)
          .toArray()
        : await productsCollection
          .aggregate()
          .project({
            _id: 0,
            name: 1,
            price: 1,
            discount: 1,
            kind: 1,
            star: 1,
            description: 1,
            uid: 1,
            image: 1,
            discounted_price: {
              $cond: [
                { $gt: ["$discount", 0] },
                { $multiply: ["$price", { $subtract: [1, "$discount"] }] },
                "$price",
              ],
            },
          })
          .match(query)
          .sort({ [sort]: order })
          .skip(offset)
          .toArray();
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: {
        data: null,
        total: total,
        limit: limit,
        offset: offset,
      },
    });
    return;
  }

  try {
    total = await productsCollection.countDocuments(query);
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: {
        data: null,
        total: total,
        limit: limit,
        offset: offset,
      },
    });
    return;
  }

  // await new Promise(resolve => setTimeout(resolve, 2000));

  res.send({
    status: 200,
    message: "Success",
    data: {
      data: data,
      total: total,
      limit: limit,
      offset: offset,
    },
  });
});

app.get("/products/categories", async function (req, res) {
  const client = await mongoClient.connect(url);
  const db = client.db("DoAn");
  const categories = db.collection("Categories");
  const products = db.collection("Products");
  let data;
  try {
    data = await categories.find().sort({ name: 1 }).toArray();
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }

  let result = new Array();
  let all = {
    kind: 0,
    name: "All",
    total: 0,
  };
  for (let index = 0; index < data.length; index++) {
    let tmp = new Object();
    let total;
    try {
      total = await products.countDocuments({ kind: data[index].kind });
    } catch (error) {
      res.status(500).send({
        status: 500,
        message: error.message || "Database error.",
        data: null,
      });
      return;
    }
    tmp.kind = data[index].kind;
    tmp.name = data[index].name;
    tmp.total = total;
    result.push(tmp);
    all.total += total;
  }
  // result.unshift(all);
  res.send(result);
});

app.get("/products/:id", async function (req, res) {
  const id = req.params.id;
  let query = {};
  let params = [];
  if (id !== undefined && id !== "") {
    params.push({ uid: parseInt(id, 10) });
  }
  if (params.length > 0) query = { $and: params };
  const client = await mongoClient.connect(url);
  const db = client.db("DoAn");
  const products = db.collection("Products");
  let data;
  try {
    data = await products.findOne(query);
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }
  res.send(data);
});

app.post("/products", uploadProduct.single("image"), async function (req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({
      status: 400,
      message: errors.array(),
      data: null,
    });
  }

  let product = {};
  const client = await mongoClient.connect(url);
  const db = client.db("DoAn");

  Object.entries(req.body).map(([k, v]) => {
    if (["price", "discount", "star", "kind"].includes(k)) {
      product[k] = k === "discount" ? Number(v) : Number(v);
    } else {
      product[k] = v;
    }
  });
  // product["star"] = 3;

  if (req.file) {
    product["image"] = "images/" + req.file.filename;
  } else {
    product["image"] = "";
  }

  const productsCollection = db.collection("Products");
  let total = 0;
  try {
    total = await productsCollection.countDocuments({ name: product["name"] });
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }
  if (total > 0) {
    res.status(400).send({
      status: 400,
      message: `Product '` + product["name"] + `' existed in the system.`,
      data: null,
    });
    return;
  }

  let tmp;
  try {
    tmp = await productsCollection
      .find()
      .sort({ uid: -1 })
      .limit(1)
      .toArray();
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }
  product["uid"] = tmp[0].uid + 1;

  try {
    await productsCollection.insertOne(product);
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }

  res.send("success");
});

app.get("/categories/:id", async function (req, res) {
  const id = req.params.id;
  let query = {};
  let params = [];
  if (id !== undefined && id !== "") {
    params.push({ id: parseInt(id, 10) });
  }
  if (params.length > 0) query = { $and: params };
  const client = await mongoClient.connect(url);
  const db = client.db("DoAn");
  const categories = db.collection("Categories");
  let data;
  try {
    data = await categories.findOne(query);
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }

  res.send(data);
});

app.post("/categories", body("name").contains(), async function (req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({
      status: 400,
      message: errors.array(),
      data: null,
    });
  }

  let category = {};
  const client = await mongoClient.connect(url);
  const db = client.db("DoAn");

  Object.entries(req.body).map(([k, v]) => {
    category[k] = v;
  });

  const categoriesCollection = db.collection("Categories");
  let total = 0;
  try {
    total = await categoriesCollection.countDocuments({ name: category["name"] });
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }
  if (total > 0) {
    res.status(400).send({
      status: 400,
      message: `Category '` + category["name"] + `' existed in the system.`,
      data: null,
    });
    return;
  }

  let tmp;
  try {
    tmp = await categoriesCollection
      .find()
      .sort({ kind: -1 })
      .limit(1)
      .toArray();
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }
  category["kind"] = tmp[0].kind + 1;

  try {
    await categoriesCollection.insertOne(category);
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }

  res.send("success");
});

app.get("/coupon/:code", async function (req, res) {
  const code = req.params.code;
  let query = {};
  let params = [];
  if (code !== undefined && code !== "") {
    params.push({ code: code });
  }
  if (params.length > 0) query = { $and: params };
  const client = await mongoClient.connect(url);
  const db = client.db("DoAn");
  const coupon = db.collection("Coupon");
  let data;
  try {
    data = await coupon.findOne(query);
    if (data === null) {
      res.status(500).send({
        status: 500,
        message: "Coupon code does not exist.",
        data: null,
      });
      return;
    }

    if (
      Date.now() < Date.parse(data.valid_from) ||
      Date.now() > Date.parse(data.valid_to)
    ) {
      res.status(500).send({
        status: 500,
        message: "Coupon code has been expired.",
        data: null,
      });
      return;
    }
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }

  res.send(data);
});

app.post("/login", async function (req, res) {
  let info = {};
  const client = await mongoClient.connect(url);
  const db = client.db("DoAn");

  Object.entries(req.body).map(([k, v]) => {
    info[k] = v;
  });

  let user;
  try {
    user = await db.collection("Users").findOne({ username: info["username"] });
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }
  if (!user) {
    res.status(400).send({
      status: 400,
      message: "Invalid username or password.",
      data: null,
    });
    return;
  }

  if (bcrypt.compareSync(info["password"], user.password)) {
    user.password = "";
    res.send(user);
  } else {
    res.status(400).send({
      status: 400,
      message: "Invalid username or password.",
      data: null,
    });
    return;
  }
});

app.post("/sign_up", uploadAvatar.single("image"), async function (req, res) {
  let user = {};
  const client = await mongoClient.connect(url);
  const db = client.db("DoAn");

  if (req.body.password !== req.body.confirm_password) {
    res.status(400).send({
      status: 400,
      message: "password does not match with confirm_password.",
      data: null,
    });
    return;
  }

  Object.entries(req.body).map(([k, v]) => {
    if (k !== "confirm_password" && k !== "image") {
      if (k === "password") {
        user[k] = bcrypt.hashSync(v, saltRounds);
      } else {
        user[k] = v;
      }
    }
  });
  if (req.file) {
    user["image"] = "avatar/" + req.file.filename;
  } else {
    user["image"] = "";
  }
  user["role"] = "customer";

  const users = db.collection("Users");
  let total = 0;
  try {
    total = await users.countDocuments({ username: user["username"] });
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }
  if (total > 0) {
    res.status(400).send({
      status: 400,
      message: `username '` + user["username"] + `' existed in the system.`,
      data: null,
    });
    return;
  }

  let data;
  try {
    data = await users.insertOne(user);
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }

  res.send("success");
});

app.get("/users/:id", async function (req, res) {
  const id = req.params.id;
  let query = {};
  let params = [];
  if (id !== undefined && id !== "") {
    if (ObjectID.isValid(id)) {
      params.push({ _id: ObjectId(id) });
    } else {
      res.status(400).send({
        status: 400,
        message: "Invalid id.",
        data: null,
      });
      return;
    }
    params.push({ _id: ObjectId(id) });
  }
  if (params.length > 0) query = { $and: params };
  const client = await mongoClient.connect(url);
  const db = client.db("DoAn");
  const coupon = db.collection("Users");
  let data;
  try {
    data = await coupon.findOne(query);
    if (data === null) {
      res.status(500).send({
        status: 500,
        message: "User does not exist.",
        data: null,
      });
      return;
    }
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }

  res.send(data);
});

app.put("/users/:id", uploadAvatar.single("image"), async function (req, res) {
  const id = req.params.id;
  let query = {};
  let params = [];
  if (id !== undefined && id !== "") {
    if (ObjectID.isValid(id)) {
      params.push({ _id: ObjectId(id) });
    } else {
      res.status(400).send({
        status: 400,
        message: "Invalid id.",
        data: null,
      });
      return;
    }
    params.push({ _id: ObjectId(id) });
  }
  if (params.length > 0) query = { $and: params };
  const client = await mongoClient.connect(url);
  const db = client.db("DoAn");
  const usersCollection = db.collection("Users");
  let user;
  try {
    user = await usersCollection.findOne(query);
    if (user === null) {
      res.status(500).send({
        status: 500,
        message: "User does not exist.",
        data: null,
      });
      return;
    }
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }
  let oldName = user.username;

  Object.entries(req.body).map(([k, v]) => {
    user[k] = v;
  });
  if (req.file) {
    user["image"] = "avatar/" + req.file.filename;
  } else {
    user["image"] = "";
  }

  if (oldName != user["username"]) {
    let total = 0;
    try {
      total = await usersCollection.countDocuments({
        username: user["username"],
      });
    } catch (error) {
      res.status(500).send({
        status: 500,
        message: error.message || "Database error.",
        data: {
          data: null,
          total: total,
          limit: limit,
          offset: offset,
        },
      });
      return;
    }
    if (total > 0) {
      res.status(400).send({
        status: 400,
        message: `username '` + user["username"] + `' existed in the system.`,
        data: null,
      });
      return;
    }
  }

  try {
    await usersCollection.updateOne({ _id: user._id }, { $set: user });
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }

  user.password = "";
  res.send(user);
});

app.post("/cart", async function (req, res) {
  let cart = {};
  const client = await mongoClient.connect(url);
  const db = client.db("DoAn");

  Object.entries(req.body).map(([k, v]) => {
    cart[k] = v;
  });
  cart["date"] = new Date(Date.now()).toISOString();

  const carts = db.collection("Carts");
  let data;
  try {
    data = await carts.insertOne(cart);
  } catch (error) {
    res.status(500).send({
      status: 500,
      message: error.message || "Database error.",
      data: null,
    });
    return;
  }

  res.send("success");
});

var server = app.listen(8081, function () {
  var host = server.address().address;
  var port = server.address().port;
  console.log("Example app listening at https://%s:%s", host, port);
});
