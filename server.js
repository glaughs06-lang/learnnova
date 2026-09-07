const express = require("express");
const path = require("path");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));


// ================================
// RAZORPAY CONFIGURATION
// ================================

if (
  !process.env.RAZORPAY_KEY_ID ||
  !process.env.RAZORPAY_KEY_SECRET
) {
  console.error("Razorpay environment variables are missing.");
}


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});


// ================================
// COURSES
// Amount is in PAISA
// ================================

const courses = {

  web_development: {
    name: "Web Development",
    amount: 49900
  },

  ethical_hacking: {
    name: "Ethical Hacking",
    amount: 79900
  },

  digital_marketing: {
    name: "Digital Marketing",
    amount: 19900
  },

  affiliate_marketing: {
    name: "Affiliate Marketing",
    amount: 14900
  }

};


// ================================
// CREATE PAYMENT ORDER
// ================================

app.post("/create-order", async (req, res) => {

  try {

    const { courseId } = req.body;

    console.log("Create order request:", courseId);

    const course = courses[courseId];


    if (!course) {

      console.error("Invalid course ID:", courseId);

      return res.status(400).json({
        success: false,
        error: "Invalid course selected"
      });

    }


    const order = await razorpay.orders.create({

      amount: course.amount,

      currency: "INR",

      receipt:
        "course_" +
        courseId +
        "_" +
        Date.now(),

      notes: {
        courseId: courseId,
        courseName: course.name
      }

    });


    console.log("Order created:", order.id);


    return res.json({

      success: true,

      orderId: order.id,

      amount: order.amount,

      currency: order.currency,

      courseName: course.name,

      keyId: process.env.RAZORPAY_KEY_ID

    });

  }

  catch (error) {

    console.error(
      "CREATE ORDER ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        error.description ||
        error.message ||
        "Could not create payment order"

    });

  }

});


// ================================
// VERIFY PAYMENT
// ================================

app.post("/verify-payment", (req, res) => {

  try {

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;


    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {

      return res.status(400).json({
        success: false,
        message: "Payment details are missing"
      });

    }


    const body =
      razorpay_order_id +
      "|" +
      razorpay_payment_id;


    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(body)
      .digest("hex");


    if (
      expectedSignature !==
      razorpay_signature
    ) {

      console.error(
        "Payment signature verification failed"
      );


      return res.status(400).json({

        success: false,

        message:
          "Payment verification failed"

      });

    }


    console.log(
      "Payment verified:",
      razorpay_payment_id
    );


    return res.json({

      success: true,

      message:
        "Payment verified successfully"

    });

  }

  catch (error) {

    console.error(
      "VERIFY PAYMENT ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      message:
        "Payment verification error"

    });

  }

});


// ================================
// HOME PAGE
// ================================

app.get("/", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  );

});


// ================================
// START SERVER
// ================================

const PORT =
  process.env.PORT || 3000;


app.listen(PORT, () => {

  console.log(
    "LearnNova server running on port " +
    PORT
  );

});
