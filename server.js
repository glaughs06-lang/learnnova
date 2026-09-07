const express = require("express");
const path = require("path");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const courses = {
  "Digital Marketing": 199,
  "Web Development": 499,
  "Ethical Hacking": 799,
  "Affiliate Marketing": 149
};

// Create Razorpay Order
app.post("/create-order", async (req, res) => {
  try {
    const { course } = req.body;

    if (!courses[course]) {
      return res.status(400).json({
        success: false,
        message: "Invalid course selected"
      });
    }

    const options = {
      amount: courses[course] * 100,
      currency: "INR",
      receipt: "course_" + Date.now()
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      order: order,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Payment order creation failed"
    });
  }
});

// Verify Payment
app.post("/verify-payment", (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    const body =
      razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      return res.json({
        success: true,
        message: "Payment verified successfully!"
      });
    }

    res.status(400).json({
      success: false,
      message: "Payment verification failed"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Payment verification error"
    });
  }
});

// Open Website
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
