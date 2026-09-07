const express = require("express");
const path = require("path");

const app = express();


// =====================================
// MIDDLEWARE
// =====================================

app.use(express.json());

app.use(
  express.static(__dirname)
);


// =====================================
// CASHFREE CONFIGURATION
// =====================================

const CASHFREE_BASE_URL =
  process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";


// =====================================
// COURSES
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
// TEMPORARY ENROLLMENT STORAGE
// =====================================

// Email -> Array of purchased courses

const enrolledCourses =
  new Map();


// =====================================
// CHECK CASHFREE KEYS
// =====================================

function cashfreeKeysAvailable() {

  return (

    process.env.CASHFREE_CLIENT_ID &&

    process.env.CASHFREE_CLIENT_SECRET

  );

}


// =====================================
// CREATE PAYMENT LINK
// =====================================

app.post(
  "/create-payment-link",
  async (req, res) => {

    try {

      if (
        !cashfreeKeysAvailable()
      ) {

        return res.status(500).json({

          success: false,

          error:
            "Cashfree payment keys are not configured"

        });

      }


      const {

        courseId,

        customerName,

        customerEmail,

        customerPhone

      } = req.body;


      // -----------------------------
      // VALIDATE COURSE
      // -----------------------------

      const course =
        courses[courseId];


      if (!course) {

        return res.status(400).json({

          success: false,

          error:
            "Invalid course selected"

        });

      }


      // -----------------------------
      // VALIDATE USER DETAILS
      // -----------------------------

      if (
        !customerName ||
        !customerEmail ||
        !customerPhone
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Name, email and phone are required"

        });

      }


      // -----------------------------
      // CLEAN PHONE NUMBER
      // -----------------------------

      let phone =
        String(
          customerPhone
        ).replace(
          /\D/g,
          ""
        );


      if (
        phone.length === 12 &&
        phone.startsWith("91")
      ) {

        phone =
          phone.substring(2);

      }


      if (
        phone.length !== 10
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Please enter a valid 10 digit mobile number"

        });

      }


      // -----------------------------
      // CREATE UNIQUE LINK ID
      // -----------------------------

      const linkId =
        "LN_" +
        Date.now() +
        "_" +
        Math.floor(
          Math.random() *
          100000
        );


      // -----------------------------
      // PAYMENT LINK DATA
      // -----------------------------

      const paymentData = {

        link_id:
          linkId,

        link_amount:
          course.amount,

        link_currency:
          "INR",

        link_purpose:
          "LearnNova - " +
          course.name,

        link_partial_payments:
          false,


        // IMPORTANT:
        // Used to identify course
        // and student after payment

        link_notes: {

          course_id:
            courseId,

          customer_email:
            customerEmail

        },


        customer_details: {

          customer_name:
            customerName,

          customer_email:
            customerEmail,

          customer_phone:
            phone

        }

      };


      console.log(
        "Creating Cashfree payment link:",
        linkId
      );


      // -----------------------------
      // CASHFREE API REQUEST
      // -----------------------------

      const response =
        await fetch(

          CASHFREE_BASE_URL +
          "/links",

          {

            method:
              "POST",

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


      const data =
        await response.json();


      // -----------------------------
      // HANDLE CASHFREE ERROR
      // -----------------------------

      if (!response.ok) {

        console.error(
          "Cashfree error:",
          data
        );


        return res.status(
          response.status
        ).json({

          success: false,

          error:

            data.message ||

            data.error ||

            "Unable to create payment link"

        });

      }


      console.log(
        "Payment link created:",
        data.link_id
      );


      // -----------------------------
      // SEND LINK TO WEBSITE
      // -----------------------------

      return res.json({

        success: true,

        courseId:
          courseId,

        course:
          course.name,

        amount:
          course.amount,

        linkId:
          data.link_id,

        paymentLink:
          data.link_url

      });

    }


    catch (error) {

      console.error(
        "CREATE PAYMENT LINK ERROR:",
        error
      );


      return res.status(500).json({

        success: false,

        error:
          "Payment server error"

      });

    }

  }
);


// =====================================
// GET PAYMENT STATUS
// =====================================

app.get(
  "/payment-status/:linkId",

  async (req, res) => {

    try {

      if (
        !cashfreeKeysAvailable()
      ) {

        return res.status(500).json({

          success: false,

          error:
            "Cashfree payment keys are not configured"

        });

      }


      const linkId =
        req.params.linkId;


      const response =
        await fetch(

          CASHFREE_BASE_URL +
          "/links/" +
          encodeURIComponent(
            linkId
          ),

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


      if (
        !response.ok
      ) {

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

        course:
          data.link_purpose,

        amount:
          data.link_amount

      });

    }


    catch (error) {

      console.error(
        "PAYMENT STATUS ERROR:",
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
// CASHFREE WEBHOOK
// =====================================

app.post(
  "/cashfree-webhook",

  async (req, res) => {

    try {

      console.log(
        "Cashfree webhook received"
      );


      // Different Cashfree events may
      // contain data in different shapes

      const webhook =
        req.body;


      const webhookData =

        webhook.data ||

        webhook;


      const linkId =

        webhookData.link_id ||

        webhookData.linkId;


      if (!linkId) {

        console.log(
          "Webhook received without link ID"
        );


        return res.status(200).json({

          success: true

        });

      }


      // -----------------------------
      // VERIFY FROM CASHFREE API
      // -----------------------------

      const response =
        await fetch(

          CASHFREE_BASE_URL +
          "/links/" +
          encodeURIComponent(
            linkId
          ),

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


      const payment =
        await response.json();


      if (
        !response.ok
      ) {

        console.error(
          "Could not verify payment:",
          payment
        );


        return res.status(200).json({

          success: true

        });

      }


      // -----------------------------
      // UNLOCK ONLY PAID COURSE
      // -----------------------------

      if (
        payment.link_status !==
        "PAID"
      ) {

        console.log(
          "Payment not completed:",
          payment.link_status
        );


        return res.status(200).json({

          success: true

        });

      }


      // -----------------------------
      // GET COURSE + STUDENT
      // -----------------------------

      const notes =
        payment.link_notes ||
        {};


      const courseId =
        notes.course_id;


      const customerEmail =
        notes.customer_email;


      if (
        !courseId ||
        !customerEmail
      ) {

        console.error(
          "Course or student data missing"
        );


        return res.status(200).json({

          success: true

        });

      }


      // -----------------------------
      // CREATE USER COURSE LIST
      // -----------------------------

      if (
        !enrolledCourses.has(
          customerEmail
        )
      ) {

        enrolledCourses.set(
          customerEmail,
          []
        );

      }


      const userCourses =
        enrolledCourses.get(
          customerEmail
        );


      // -----------------------------
      // PREVENT DUPLICATE ENROLLMENT
      // -----------------------------

      const alreadyExists =
        userCourses.some(

          item =>

            item.courseId ===
            courseId

        );


      if (
        !alreadyExists
      ) {

        userCourses.push({

          courseId:
            courseId,

          courseName:
            courses[
              courseId
            ]?.name ||
            courseId,

          amount:
            courses[
              courseId
            ]?.amount ||
            0,

          paymentLinkId:
            linkId,

          unlockedAt:
            new Date()
              .toISOString()

        });


        console.log(
          "Course unlocked:",
          courseId,
          "for:",
          customerEmail
        );

      }


      return res.status(200).json({

        success: true

      });

    }


    catch (error) {

      console.error(
        "WEBHOOK ERROR:",
        error
      );


      // Return 200 so webhook
      // is not endlessly retried

      return res.status(200).json({

        success: true

      });

    }

  }
);


// =====================================
// GET MY COURSES
// =====================================

app.get(
  "/my-courses/:email",

  (req, res) => {

    const email =
      req.params.email;


    const userCourses =
      enrolledCourses.get(
        email
      ) || [];


    return res.json({

      success: true,

      courses:
        userCourses

    });

  }
);


// =====================================
// HOME PAGE
// =====================================

app.get(
  "/",

  (req, res) => {

    res.sendFile(

      path.join(

        __dirname,

        "index.html"

      )

    );

  }
);


// =====================================
// SERVER
// =====================================

const PORT =

  process.env.PORT ||

  3000;


app.listen(

  PORT,

  () => {

    console.log(

      "LearnNova server running on port " +

      PORT

    );

  }

);
