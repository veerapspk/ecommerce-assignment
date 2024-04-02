const express = require("express");
const app = express();
const path = require("path");
const sqlite = require("sqlite");
const { open } = sqlite;
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const dbPath = path.join(__dirname, "eCommerce.db");
app.use(express.json());
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => console.log("Server is running on port 3000"));
  } catch (e) {
    console.error("Error initializing database:", e.message);
    process.exit(1);
  }
};

initializeDbAndServer();

// Registration API  for Admin
app.post("/admin/register/", async (request, response) => {
  const { username, password } = request.body;

  // Checking if admin already exists
  const existingAdminQuery = `SELECT * FROM admins WHERE username = "${username}";`;
  const existingAdmin = await db.get(existingAdminQuery);

  if (existingAdmin) {
    response.status(400);
    response.send({ errorMsg: "Admin already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert new admin record into the database
  const insertAdmin = `
    INSERT INTO admins (username, password)
    VALUES ('${username}', '${hashedPassword}')
  `;
  await db.run(insertAdmin);

  response.send({ message: "Admin registered successfully" });
});
// Admin Login
app.post("/admin/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM admins WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid Admin");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username, role: "admin" }; // Include role in payload
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN"); // Sign JWT token with payload
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

// Registration API for user
app.post("/user/register", async (request, response) => {
  const { username, password } = request.body;

  // Checking if admin already exists
  const existingAdminQuery = `SELECT * FROM users WHERE username = "${username}";`;
  const existingAdmin = await db.get(existingAdminQuery);

  if (existingAdmin) {
    response.status(400);
    response.send({ errorMsg: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Insert new admin record into the database
  const insertUser = `
    INSERT INTO users (username, password)
    VALUES ('${username}', '${hashedPassword}')
  `;
  await db.run(insertUser);

  response.send({ message: "User registered successfully" });
});
//User Login
app.post("/user/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
        role: "user",
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      const { userId } = dbUser;
      console.log(userId);
      console.log(jwtToken);
      response.send({ jwtToken, payload, userId });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

// middleware functions for Admin Authentication

const verifyAdminToken = (request, response, next) => {
  const token = request.headers.authorization;

  if (!token) {
    response.status(401);
    response.send({ errorMsg: "No token provided" });
  }
  const jwtToken = token.split(" ")[1];

  jwt.verify(jwtToken, "MY_SECRET_TOKEN", (err, decoded) => {
    if (err) {
      response.status(401);
      response.send({ errorMsg: "Invalid token" });
    }

    if (decoded.role !== "admin") {
      response.status(403);
      response.send({ errorMsg: "Unauthorized" });
    }

    const { body } = request;

    next();
  });
};

// middleware functions for user Authentication
const verifyUserToken = (request, response, next) => {
  const token = request.headers.authorization;

  if (!token) {
    response.status(401);
    response.send({ errorMsg: "No token provided" });
  }
  const jwtToken = token.split(" ")[1];

  jwt.verify(jwtToken, "MY_SECRET_TOKEN", (err, decoded) => {
    if (err) {
      response.status(401);
      response.send({ errorMsg: "Invalid token" });
    }

    if (decoded.role !== "user") {
      response.status(403);
      response.send({ errorMsg: "Unauthorized" });
    }

    const { body } = request;

    next();
  });
};

// admin_________________________________________________ actions

// admin delete products api
app.delete(
  "/admin/product/:productId",
  verifyAdminToken,
  async (request, response) => {
    const { productId } = request.params;
    const deleteQuery = `DELETE FROM products WHERE productId='${productId}'`;
    const dbResponse = await db.run(deleteQuery);
    response.send({ message: "Product Deleted Successfully", dbResponse });
  }
);
// admin update products details api
app.put(
  "/admin/product/:productId",
  verifyAdminToken,
  async (request, response) => {
    const { productId } = request.params;
    const product = request.body;
    const productExistQuery = `SELECT * FROM products WHERE productId = '${productId}';`;
    const dbResponse = await db.get(productExistQuery);
    if (dbResponse === undefined) {
      response.status(400);
      response.send({ errorMsg: "Product Not Found" });
    }

    const deleteQuery = `DELETE FROM products WHERE productId='${productId}';`;
    await db.run(deleteQuery);
    const updatedProduct = { ...product, ...dbResponse };
    console.log(updatedProduct);
    const {
      title,
      price,
      rating,
      description,
      brand,
      id,
      imageUrl,
    } = updatedProduct;

    const insertQuery = `INSERT INTO products(productId,brand,price,rating,imageUrl,description,title) VALUES("${productId}","${brand}",${price},${rating},"${imageUrl}","${description}","${title}");`;
    const dbResult = await db.run(insertQuery);
    response.send({ message: "Product Updated Successfully " });
  }
);

//admin add new  products api

app.post("/admin/products/add", verifyAdminToken, async (request, response) => {
  const productsArray = request.body;
  let dbResult = null;

  try {
    for (const each of productsArray) {
      const { imageUrl, price, rating, brand, description, title } = each;
      const productId = uuidv4();
      const insertQuery = `INSERT INTO products(productId,brand,price,rating,imageUrl,description,title) VALUES("${productId}","${brand}",${price},${rating},"${imageUrl}","${description}","${title}");`;
      dbResult = await db.run(insertQuery);
    }
    const { lastID } = dbResult;
    response.send({ message: "Products Added Successfully", lastID });
  } catch (error) {
    console.log(error);
  }
});

// admin products api

app.get("/admin/products", verifyAdminToken, async (request, response) => {
  const {
    sort_by_price = "PRICE_HIGH",
    title_search = "",
    rating = "0",
  } = request.query;

  const sort = sort_by_price === "PRICE_HIGH" ? "DESC" : "ASC";
  const dbQuery = `SELECT * FROM products WHERE title LIKE '%${title_search}%'AND rating > '${rating}' ORDER BY price ${sort};`;
  const dbResponse = await db.all(dbQuery);
  response.send(dbResponse);
});

// admin product details api

app.get(
  "/admin/products/:productId",
  verifyUserToken,
  async (request, response) => {
    const { productId } = request.params;

    const dbQuery = `SELECT * FROM products WHERE productId ='${productId}';`;
    const dbResponse = await db.get(dbQuery);
    response.send(dbResponse);
  }
);

//admin api for purchases list

app.get("/admin/purchase/", verifyAdminToken, async (request, response) => {
  const purchsesQuery = `
        SELECT *
        FROM purchases
        ORDER BY date_column DESC;`;
  const dbResponse = await db.all(purchsesQuery);
  response.send({ dbResponse });
});

// user _____________________________________ actions

// user products api

app.get("/user/products", verifyUserToken, async (request, response) => {
  const {
    sort_by_price = "PRICE_HIGH",
    title_search = "",
    rating = "0",
  } = request.query;

  const sort = sort_by_price === "PRICE_HIGH" ? "DESC" : "ASC";
  const dbQuery = `SELECT * FROM products WHERE title LIKE '%${title_search}%'AND rating > '${rating}' ORDER BY price ${sort};`;
  const dbResponse = await db.all(dbQuery);
  response.send(dbResponse);
});

// user product-details api

app.get(
  "/user/products/:productId",
  verifyUserToken,
  async (request, response) => {
    const { productId } = request.params;

    const dbQuery = `SELECT * FROM products WHERE productId ='${productId}';`;
    const dbResponse = await db.get(dbQuery);
    response.send(dbResponse);
  }
);

// user cart api to show list of products

app.post("/user/cart/", verifyUserToken, async (request, response) => {
  try {
    const { userId, cartItems } = request.body;

    // Loop through each item in the cartItems array
    for (const cartItem of cartItems) {
      const { productId, quantity } = cartItem;

      // Checking if the product already exists in the user's cart
      const existingCartItemQuery = `
        SELECT * FROM user_carts WHERE userId = ${userId} AND productId = '${productId}'
      `;
      const existingCartItem = await db.get(existingCartItemQuery);

      if (existingCartItem) {
        // If the product exists, update its quantity
        const updatedQuantity = existingCartItem.quantity + quantity;
        const updateCartItemQuery = `
          UPDATE user_carts SET quantity = ${updatedQuantity} 
          WHERE userId = ${userId} AND productId = '${productId}'
        `;
        await db.run(updateCartItemQuery);
      } else {
        // If the product doesn't exist, insert a new record
        const insertCartItemQuery = `
          INSERT INTO user_carts (userId, productId, quantity) 
          VALUES (${userId}, '${productId}', ${quantity})
        `;
        await db.run(insertCartItemQuery);
      }
    }

    // Get the updated list of products in the user's cart
    const getUserCartQuery = `
      SELECT p.productId, p.title, p.price, p.description, p.imageUrl, p.brand, p.rating, c.quantity
      FROM products p INNER JOIN user_carts c ON p.productId = c.productId
      WHERE c.userId = ${userId}
    `;
    const userCartProducts = await db.all(getUserCartQuery);

    response.send({
      message: "Cart updated successfully",
      cartProducts: userCartProducts,
    });
  } catch (error) {
    console.error("Error updating user cart:", error);
    response.status(500).send({ error: "Internal server error" });
  }
});

// user api for removing cart item

app.delete(
  "/user/cart/:userId/:productId",
  verifyUserToken,
  async (request, response) => {
    const userId = request.params.userId;
    const productId = request.params.productId;

    const deleteQuery = `DELETE FROM user_carts WHERE userId =${userId} AND productId ='${productId}'`;
    await db.run(deleteQuery);

    response.send({ message: "Item removed from cart successfully" });
  }
);

// user purchases updating api

app.put("user/cart/purchase", verifyUserToken, async (request, response) => {
  const { cartItems, purchaseDate } = request.body;

  let valuesString = "";

  for (const each of cartItems) {
    const { productId, userId, quantity, title } = each;
    valuesString += `('${productId}', ${userId}, ${quantity},'${title}','${purchaseDate}'), `;
  }
  valuesString = valuesString.slice(0, -2);
  const insertQuery = `
    INSERT INTO purchases (productId, userId, quantity,title,purchaseDate) 
    VALUES ${valuesString};`;

  const dbResponse = await db.run(insertQuery);
  const deletePurchaseQuery = `DELETE FROM user_carts WHERE userId=${userId};`;
  await db.run(deletePurchaseQuery);

  response.send({ message: "products purchased successfully" });
});

// user cart quantity update api

app.put(
  "/user/cart/:userId/:productId",
  verifyUserToken,
  async (request, response) => {
    const userId = request.params.userId;
    const productId = request.params.productId;
    const { quantity } = request.body;
    const updateQuery = `UPDATE user_carts SET quantity = ${quantity} WHERE userId = ${userId} AND productId = '${productId}'`;
    await db.run(updateQuery);
    response.send({ message: "Item quantity updated successfully" });
  }
);

app.post("/dummy/result", async (request, response) => {
  const v = 918200;
  const query = `ALTER TABLE purchases ADD COLUMN title TEXT;`;
  const items = await db.run(query);
  console.log(items);
  response.send(items);
});

// all set for till now..so the next task is to
