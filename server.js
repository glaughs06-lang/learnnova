const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const courses = {
  digital_marketing: {
    name: "Digital Marketing",
    amount: 19900
  },
  web_development: {
    name: "Web Development",
    amount: 49900
  },
  ethical_hacking: {
    name: "Ethical Hacking",
    amount: 79900
  },
  affiliate_marketing: {
    name: "Affiliate Marketing",
    amount: 14900
  }
};

app.post("/create-order", async (req, res) => {
  try {
    const course = courses[req.body.course];

    if (!course) {
      return res.status(400).json({ error: "Invalid course" });
    }

    const order = await razorpay.orders.create({
      amount: course.amount,
      currency: "INR",
      receipt: "course_" + Date.now()
    });

    res.json({
      order,
      course
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Could not create payment order"
    });
  }
});

app.post("/verify-payment", (req, res) => {
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
    .update(body)
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    res.json({
      success: true,
      message: "Payment verified successfully"
    });
  } else {
    res.status(400).json({
      success: false,
      message: "Payment verification failed"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
