const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ==========================================
// LEARNNOVA CONFIGURATION
// ==========================================

const PORT = process.env.PORT || 3000;

const CASHFREE_ENV =
  process.env.CASHFREE_ENV || "sandbox";


const CASHFREE_BASE_URL =
  CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";


// आपकी Render Website URL
const APP_URL =
  process.env.APP_URL ||
  "https://learnnova-1.onrender.com";


// ==========================================
// COURSES
// ==========================================

const courses = {

  web_development: {
    id: "web_development",
    name: "Web Development",
    amount: 499
  },

  ethical_hacking: {
    id: "ethical_hacking",
    name: "Ethical Hacking",
    amount: 799
  },

  digital_marketing: {
    id: "digital_marketing",
    name: "Digital Marketing",
    amount: 199
  },

  affiliate_marketing: {
    id: "affiliate_marketing",
    name: "Affiliate Marketing",
    amount: 149
  }

};


// ==========================================
// CASHFREE HEADERS
// ==========================================

function getCashfreeHeaders() {

  return {

    "Content-Type":
      "application/json",

    "x-api-version":
      "2025-01-01",

    "x-client-id":
      process.env.CASHFREE_CLIENT_ID,

    "x-client-secret":
      process.env.CASHFREE_CLIENT_SECRET

  };

}


// ==========================================
// CHECK CASHFREE CONFIGURATION
// ==========================================

function checkCashfreeKeys(req, res) {

  if (
    !process.env.CASHFREE_CLIENT_ID ||
    !process.env.CASHFREE_CLIENT_SECRET
  ) {

    res.status(500).json({

      success: false,

      error:
        "Cashfree API keys are not configured."

    });

    return false;

  }

  return true;

}


// ==========================================
// CREATE PAYMENT LINK
// ==========================================

app.post(
  "/create-payment-link",
  async (req, res) => {

    try {

      console.log(
        "Payment request received:",
        req.body
      );


      // ----------------------------------
      // CHECK KEYS
      // ----------------------------------

      if (
        !checkCashfreeKeys(
          req,
          res
        )
      ) {

        return;

      }


      const {

        courseId,
        customerName,
        customerEmail,
        customerPhone

      } = req.body;


      // ----------------------------------
      // VALIDATE COURSE
      // ----------------------------------

      if (!courseId) {

        return res.status(400).json({

          success: false,

          error:
            "Course ID is missing."

        });

      }


      const course =
        courses[courseId];


      if (!course) {

        return res.status(400).json({

          success: false,

          error:
            "Invalid course selected."

        });

      }


      // ----------------------------------
      // VALIDATE PHONE
      // ----------------------------------

      let phone =
        String(
          customerPhone || ""
        )
        .replace(
          /\D/g,
          ""
        );


      // Remove 91 from Indian number

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
            "Please enter a valid 10 digit mobile number."

        });

      }


      // ----------------------------------
      // CREATE UNIQUE LINK ID
      // ----------------------------------

      const linkId =
        "LN_" +
        Date.now() +
        "_" +
        Math.floor(
          Math.random() * 100000
        );


      // ----------------------------------
      // PAYMENT DATA
      // ----------------------------------

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


        customer_details: {

          customer_name:
            customerName ||
            "LearnNova Student",

          customer_email:
            customerEmail || "",

          customer_phone:
            phone

        },


        // --------------------------------
        // AFTER PAYMENT RETURN
        // --------------------------------

        link_meta: {

          return_url:
            APP_URL +
            "/dashboard.html?link_id=" +
            encodeURIComponent(
              linkId
            )

        },


        // --------------------------------
        // INTERNAL COURSE INFORMATION
        // --------------------------------

        link_notes: {

          course_id:
            course.id,

          course_name:
            course.name

        }

      };


      console.log(
        "Creating Cashfree Payment Link..."
      );


      // ----------------------------------
      // CALL CASHFREE API
      // ----------------------------------

      const cashfreeResponse =
        await fetch(

          CASHFREE_BASE_URL +
          "/links",

          {

            method:
              "POST",

            headers:
              getCashfreeHeaders(),

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


      // ----------------------------------
      // HANDLE CASHFREE ERROR
      // ----------------------------------

      if (
        !cashfreeResponse.ok
      ) {

        return res.status(
          cashfreeResponse.status
        ).json({

          success: false,

          error:
            cashfreeData.message ||
            cashfreeData.error ||
            "Unable to create payment link."

        });

      }


      // ----------------------------------
      // SUCCESS
      // ----------------------------------

      return res.json({

        success: true,

        paymentLink:
          cashfreeData.link_url,

        linkId:
          cashfreeData.link_id,

        courseId:
          course.id,

        course:
          course.name,

        amount:
          course.amount

      });

    }


    catch (error) {

      console.error(
        "CREATE PAYMENT ERROR:",
        error
      );


      return res.status(500).json({

        success: false,

        error:
          error.message ||
          "Payment server error. Please try again."

      });

    }

  }
);


// ==========================================
// VERIFY PAYMENT
// ==========================================

app.get(
  "/verify-payment/:linkId",

  async (req, res) => {

    try {

      if (
        !checkCashfreeKeys(
          req,
          res
        )
      ) {

        return;

      }


      const linkId =
        req.params.linkId;


      if (!linkId) {

        return res.status(400).json({

          success: false,

          error:
            "Payment Link ID is missing."

        });

      }


      console.log(
        "Verifying payment:",
        linkId
      );


      // ----------------------------------
      // GET PAYMENT LINK DETAILS
      // ----------------------------------

      const response =
        await fetch(

          CASHFREE_BASE_URL +
          "/links/" +
          encodeURIComponent(
            linkId
          ),

          {

            method:
              "GET",

            headers:
              getCashfreeHeaders()

          }

        );


      const data =
        await response.json();


      console.log(
        "Payment verification response:",
        data
      );


      if (!response.ok) {

        return res.status(
          response.status
        ).json({

          success: false,

          error:
            data.message ||
            data.error ||
            "Unable to verify payment."

        });

      }


      // ----------------------------------
      // CHECK PAYMENT STATUS
      // ----------------------------------

      const linkStatus =
        data.link_status;


      const amountPaid =
        Number(
          data.link_amount_paid || 0
        );


      const amount =
        Number(
          data.link_amount || 0
        );


      const paid =

        (
          linkStatus === "PAID"
        ) ||

        (
          amount > 0 &&
          amountPaid >= amount
        );


      // ----------------------------------
      // GET COURSE
      // ----------------------------------

      const courseName =
        data.link_notes?.course_name ||
        data.link_purpose ||
        "LearnNova Course";


      const courseId =
        data.link_notes?.course_id ||
        null;


      return res.json({

        success: true,

        paid:
          paid,

        status:
          linkStatus,

        linkId:
          data.link_id,

        courseId:
          courseId,

        courseName:
          courseName,

        amount:
          amount,

        amountPaid:
          amountPaid

      });

    }


    catch (error) {

      console.error(
        "VERIFY PAYMENT ERROR:",
        error
      );


      return res.status(500).json({

        success: false,

        error:
          error.message ||
          "Unable to verify payment."

      });

    }

  }
);


// ==========================================
// PAYMENT STATUS ALIAS
// ==========================================

app.get(
  "/payment-status/:linkId",

  async (req, res) => {

    try {

      if (
        !process.env.CASHFREE_CLIENT_ID ||
        !process.env.CASHFREE_CLIENT_SECRET
      ) {

        return res.status(500).json({

          success: false,

          error:
            "Cashfree keys are not configured."

        });

      }


      const response =
        await fetch(

          CASHFREE_BASE_URL +
          "/links/" +
          encodeURIComponent(
            req.params.linkId
          ),

          {

            headers:
              getCashfreeHeaders()

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
            "Unable to check payment."

        });

      }


      return res.json({

        success: true,

        status:
          data.link_status,

        amount:
          data.link_amount,

        amountPaid:
          data.link_amount_paid,

        course:
          data.link_purpose

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
          "Unable to check payment status."

      });

    }

  }
);


// ==========================================
// HOME PAGE
// ==========================================

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


// ==========================================
// DASHBOARD PAGE
// ==========================================

app.get(
  "/dashboard.html",

  (req, res) => {

    res.sendFile(

      path.join(
        __dirname,
        "dashboard.html"
      )

    );

  }
);


// ==========================================
// SERVER START
// ==========================================

app.listen(

  PORT,

  () => {

    console.log(
      "================================="
    );

    console.log(
      "LearnNova server is running"
    );

    console.log(
      "Port:",
      PORT
    );

    console.log(
      "Cashfree Environment:",
      CASHFREE_ENV
    );

    console.log(
      "================================="
    );

  }

);
