const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));


// =====================================
// CASHFREE CONFIGURATION
// =====================================

// TEST MODE
const CASHFREE_BASE_URL =
  process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";


// =====================================
// COURSES
// Amount is in RUPEES
// =====================================

const courses = {

  web_development: {
    name: "Web Development",
    amount: 499
  },

  ethical_hacking: {
    name: "Ethical Hacking",
    amount: 799
  },

  digital_marketing: {
    name: "Digital Marketing",
    amount: 199
  },

  affiliate_marketing: {
    name: "Affiliate Marketing",
    amount: 149
  }

};


// =====================================
// CREATE CASHFREE PAYMENT LINK
// =====================================

app.post("/create-payment-link", async (req, res) => {

  try {

    console.log("Payment request:", req.body);


    // ---------------------------------
    // CHECK CASHFREE KEYS
    // ---------------------------------

    if (
      !process.env.CASHFREE_CLIENT_ID ||
      !process.env.CASHFREE_CLIENT_SECRET
    ) {

      console.error(
        "Cashfree environment variables are missing"
      );

      return res.status(500).json({
        success: false,
        error:
          "Cashfree payment keys are not configured"
      });

    }


    // ---------------------------------
    // GET DATA
    // ---------------------------------

    const {
      courseId,
      customerName,
      customerEmail,
      customerPhone
    } = req.body;


    // ---------------------------------
    // VALIDATE COURSE
    // ---------------------------------

    if (!courseId) {

      return res.status(400).json({
        success: false,
        error: "Course ID is missing"
      });

    }


    const course = courses[courseId];


    if (!course) {

      console.error(
        "Invalid course:",
        courseId
      );

      return res.status(400).json({
        success: false,
        error: "Invalid course selected"
      });

    }


    // ---------------------------------
    // VALIDATE CUSTOMER PHONE
    // ---------------------------------

    if (
      !customerPhone ||
      customerPhone.length < 10
    ) {

      return res.status(400).json({
        success: false,
        error:
          "Please enter a valid mobile number"
      });

    }


    // ---------------------------------
    // CREATE UNIQUE LINK ID
    // Maximum length kept below 50 chars
    // ---------------------------------

    const linkId =
      "LN_" +
      Date.now() +
      "_" +
      Math.floor(
        Math.random() * 10000
      );


    // ---------------------------------
    // CASHFREE PAYMENT LINK DATA
    // ---------------------------------

    const paymentData = {

      link_id: linkId,

      link_amount: course.amount,

      link_currency: "INR",

      link_purpose:
        "LearnNova - " +
        course.name,

      link_partial_payments: false,


      customer_details: {

        customer_name:
          customerName ||
          "LearnNova Student",

        customer_email:
          customerEmail ||
          "",

        customer_phone:
          customerPhone

      }

    };


    console.log(
      "Creating Cashfree payment link..."
    );


    // ---------------------------------
    // CALL CASHFREE API
    // ---------------------------------

    const cashfreeResponse =
      await fetch(
        CASHFREE_BASE_URL + "/links",
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "x-api-version":
              "2025-01-01",

            "x-client-id":
              process.env
                .CASHFREE_CLIENT_ID,

            "x-client-secret":
              process.env
                .CASHFREE_CLIENT_SECRET

          },

          body:
            JSON.stringify(
              paymentData
            )

        }
      );


    const cashfreeData =
      await cashfreeResponse.json();


    console.log(
      "Cashfree response:",
      cashfreeData
    );


    // ---------------------------------
    // CHECK ERROR
    // ---------------------------------

    if (!cashfreeResponse.ok) {

      return res.status(
        cashfreeResponse.status
      ).json({

        success: false,

        error:
          cashfreeData.message ||
          cashfreeData.error ||
          "Unable to create payment link"

      });

    }


    // ---------------------------------
    // SEND LINK TO WEBSITE
    // ---------------------------------

    return res.json({

      success: true,

      course: course.name,

      amount: course.amount,

      paymentLink:
        cashfreeData.link_url,

      linkId:
        cashfreeData.link_id

    });

  }


  catch (error) {

    console.error(
      "PAYMENT LINK ERROR:",
      error
    );


    return res.status(500).json({

      success: false,

      error:
        error.message ||
        "Unable to create payment link"

    });

  }

});


// =====================================
// CHECK PAYMENT LINK STATUS
// =====================================

app.get(
  "/payment-status/:linkId",
  async (req, res) => {

    try {

      const linkId =
        req.params.linkId;


      const response =
        await fetch(

          CASHFREE_BASE_URL +
          "/links/" +
          encodeURIComponent(linkId),

          {

            headers: {

              "x-api-version":
                "2025-01-01",

              "x-client-id":
                process.env
                  .CASHFREE_CLIENT_ID,

              "x-client-secret":
                process.env
                  .CASHFREE_CLIENT_SECRET

            }

          }

        );


      const data =
        await response.json();


      if (!response.ok) {

        return res.status(
          response.status
        ).json({

          success: false,

          error:
            data.message ||
            "Unable to check payment"

        });

      }


      return res.json({

        success: true,

        status:
          data.link_status,

        amount:
          data.link_amount,

        course:
          data.link_purpose

      });

    }


    catch (error) {

      console.error(
        "STATUS CHECK ERROR:",
        error
      );


      return res.status(500).json({

        success: false,

        error:
          "Unable to check payment status"

      });

    }

  }
);


// =====================================
// HOME PAGE
// =====================================

app.get("/", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "index.html"
    )
  );

});


// =====================================
// SERVER
// =====================================

const PORT =
  process.env.PORT ||
  3000;


app.listen(PORT, () => {

  console.log(
    "LearnNova server running on port " +
    PORT
  );

});
