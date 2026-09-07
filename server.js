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



// CREATE PAYMENT ORDER

app.post("/create-order", async (req, res) => {

  try {

    const courseId = req.body.courseId;


    const course = courses[courseId];


    if (!course) {

      return res.status(400).json({

        success: false,

        error: "Invalid course"

      });

    }


    const order = await razorpay.orders.create({

      amount: course.amount,

      currency: "INR",

      receipt:

        "course_" +
        courseId +
        "_" +
        Date.now()

    });


    res.json({

      success: true,

      order: order,

      course: course.name

    });

  }

  catch (error) {

    console.error(error);


    res.status(500).json({

      success: false,

      error: "Could not create payment order"

    });

  }

});




// VERIFY PAYMENT

app.post("/verify-payment", (req, res) => {

  try {

    const {

      razorpay_order_id,

      razorpay_payment_id,

      razorpay_signature

    } = req.body;


    const body =

      razorpay_order_id +

      "|" +

      razorpay_payment_id;


    const expectedSignature =

      crypto

      .createHmac(

        "sha256",

        process.env.RAZORPAY_KEY_SECRET

      )

      .update(body)

      .digest("hex");


    if (

      expectedSignature ===

      razorpay_signature

    ) {

      return res.json({

        success: true,

        message:

          "Payment verified successfully"

      });

    }


    return res.status(400).json({

      success: false,

      message:

        "Payment verification failed"

    });

  }

  catch (error) {

    console.error(error);


    res.status(500).json({

      success: false,

      message:

        "Payment verification error"

    });

  }

});




// HOME PAGE

app.get("/", (req, res) => {

  res.sendFile(

    path.join(

      __dirname,

      "index.html"

    )

  );

});



const PORT =

  process.env.PORT ||

  3000;


app.listen(PORT, () => {

  console.log(

    "LearnNova server running on port " +

    PORT

  );

});
