const express = require("express");
const path = require("path");

const app = express();
app.use(express.static(path.join(__dirname)));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// =============================================
// CONFIG
// =============================================

const PORT = process.env.PORT || 3000;

const APP_URL = "https://learnnova-1.onrender.com";

const CASHFREE_ENV =
  process.env.CASHFREE_ENV || "sandbox";

const CASHFREE_BASE_URL =
  CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";


// =============================================
// COURSES
// =============================================

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


// =============================================
// CASHFREE HEADERS
// =============================================

function getCashfreeHeaders() {

  return {

    "Content-Type": "application/json",

    "x-api-version": "2025-01-01",

    "x-client-id":
      process.env.CASHFREE_CLIENT_ID,

    "x-client-secret":
      process.env.CASHFREE_CLIENT_SECRET

  };

}


// =============================================
// CHECK CASHFREE CONFIG
// =============================================

function checkCashfreeConfig(res) {

  if (
    !process.env.CASHFREE_CLIENT_ID ||
    !process.env.CASHFREE_CLIENT_SECRET
  ) {

    res.status(500).json({

      success: false,

      error:
        "Cashfree API keys are not configured on the server."

    });

    return false;

  }

  return true;

}


// =============================================
// SAFE JSON RESPONSE
// =============================================

async function getResponseData(response) {

  const text =
    await response.text();

  try {

    return JSON.parse(text);

  }

  catch {

    return {

      raw:
        text

    };

  }

}


// =============================================
// CREATE PAYMENT LINK
// =============================================

app.post(
  "/create-payment-link",

  async (req, res) => {

    try {

      console.log(
        "===================================="
      );

      console.log(
        "PAYMENT REQUEST RECEIVED"
      );

      console.log(
        req.body
      );


      if (
        !checkCashfreeConfig(res)
      ) {

        return;

      }


      const {

        courseId,
        customerName,
        customerEmail,
        customerPhone

      } = req.body;


      // -----------------------------------------
      // CHECK COURSE
      // -----------------------------------------

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


      // -----------------------------------------
      // CLEAN PHONE NUMBER
      // -----------------------------------------

      let phone =
        String(
          customerPhone || ""
        )
          .replace(
            /\D/g,
            ""
          );


      // Remove India country code 91

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


      // -----------------------------------------
      // CREATE UNIQUE LINK ID
      // -----------------------------------------

      const linkId =
        "LN_" +
        Date.now() +
        "_" +
        Math.floor(
          Math.random() * 100000
        );


      // -----------------------------------------
      // CUSTOMER DETAILS
      // -----------------------------------------

      const customerDetails = {

        customer_name:
          customerName ||
          "LearnNova Student",

        customer_phone:
          phone

      };


      // Email optional

      if (
        customerEmail &&
        String(customerEmail).trim()
      ) {

        customerDetails.customer_email =
          String(
            customerEmail
          ).trim();

      }


      // -----------------------------------------
      // CASHFREE PAYMENT DATA
      // -----------------------------------------

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

        customer_details:
          customerDetails,

        link_notify: {

          send_sms:
            false,

          send_email:
            false

        },

        link_auto_reminders:
          false,

        link_meta: {

          return_url:

            APP_URL +

            "/dashboard.html?link_id=" +

            encodeURIComponent(
              linkId
            )

        },

        link_notes: {

          course_id:
            course.id,

          course_name:
            course.name

        }

      };


      console.log(
        "Creating Cashfree payment link..."
      );


      // -----------------------------------------
      // CALL CASHFREE
      // -----------------------------------------

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
        await getResponseData(
          cashfreeResponse
        );


      console.log(
        "Cashfree HTTP Status:",
        cashfreeResponse.status
      );

      console.log(
        "Cashfree Response:",
        cashfreeData
      );


      // -----------------------------------------
      // CASHFREE ERROR
      // -----------------------------------------

      if (
        !cashfreeResponse.ok
      ) {

        return res.status(
          cashfreeResponse.status
        ).json({

          success:
            false,

          error:

            cashfreeData.message ||

            cashfreeData.error ||

            cashfreeData.raw ||

            "Cashfree was unable to create the payment link."

        });

      }


      // -----------------------------------------
      // CHECK PAYMENT LINK
      // -----------------------------------------

      if (
        !cashfreeData ||
        !cashfreeData.link_url ||
        !cashfreeData.link_id
      ) {

        console.error(
          "Invalid Cashfree response:",
          cashfreeData
        );


        return res.status(500).json({

          success:
            false,

          error:
            "Cashfree returned an invalid payment link response."

        });

      }


      // -----------------------------------------
      // SUCCESS RESPONSE
      // -----------------------------------------

      return res.json({

        success:
          true,

        paymentLink:
          cashfreeData.link_url,

        linkId:
          cashfreeData.link_id,

        courseId:
          course.id,

        courseName:
          course.name,

        amount:
          course.amount

      });

    }


    catch (error) {

      console.error(
        "CREATE PAYMENT ERROR:"
      );

      console.error(
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          error.message ||
          "Payment server error."

      });

    }

  }

);


// =============================================
// VERIFY PAYMENT
// =============================================

app.get(
  "/verify-payment/:linkId",

  async (req, res) => {

    try {

      if (
        !checkCashfreeConfig(res)
      ) {

        return;

      }


      const linkId =
        req.params.linkId;


      if (!linkId) {

        return res.status(400).json({

          success:
            false,

          error:
            "Payment Link ID is missing."

        });

      }


      console.log(
        "Verifying payment:",
        linkId
      );


      // -----------------------------------------
      // GET PAYMENT LINK DETAILS
      // -----------------------------------------

      const cashfreeResponse =
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


      const cashfreeData =
        await getResponseData(
          cashfreeResponse
        );


      console.log(
        "Verification HTTP Status:",
        cashfreeResponse.status
      );

      console.log(
        "Verification Response:",
        cashfreeData
      );


      if (
        !cashfreeResponse.ok
      ) {

        return res.status(
          cashfreeResponse.status
        ).json({

          success:
            false,

          error:

            cashfreeData.message ||

            cashfreeData.error ||

            cashfreeData.raw ||

            "Unable to verify payment."

        });

      }


      // -----------------------------------------
      // PAYMENT STATUS
      // -----------------------------------------

      const status =
        cashfreeData.link_status ||
        "UNKNOWN";


      const amount =
        Number(
          cashfreeData.link_amount ||
          0
        );


      const amountPaid =
        Number(
          cashfreeData.link_amount_paid ||
          0
        );


      const paid =

        status === "PAID" ||

        (

          amount > 0 &&

          amountPaid >= amount

        );


      // -----------------------------------------
      // COURSE INFORMATION
      // -----------------------------------------

      const courseId =
        cashfreeData.link_notes
          ?.course_id ||

        null;


      const courseName =
        cashfreeData.link_notes
          ?.course_name ||

        cashfreeData.link_purpose ||

        "LearnNova Course";


      // -----------------------------------------
      // SEND RESULT
      // -----------------------------------------

      return res.json({

        success:
          true,

        paid:
          paid,

        status:
          status,

        linkId:
          cashfreeData.link_id ||
          linkId,

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
        "VERIFY PAYMENT ERROR:"
      );

      console.error(
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          error.message ||
          "Unable to verify payment."

      });

    }

  }

);


// =============================================
// PAYMENT STATUS
// =============================================

app.get(
  "/payment-status/:linkId",

  async (req, res) => {

    try {

      if (
        !checkCashfreeConfig(res)
      ) {

        return;

      }


      const linkId =
        req.params.linkId;


      const cashfreeResponse =
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
        await getResponseData(
          cashfreeResponse
        );


      if (
        !cashfreeResponse.ok
      ) {

        return res.status(
          cashfreeResponse.status
        ).json({

          success:
            false,

          error:

            data.message ||

            data.error ||

            "Unable to check payment."

        });

      }


      return res.json({

        success:
          true,

        status:
          data.link_status,

        paid:
          data.link_status === "PAID",

        amount:
          Number(
            data.link_amount ||
            0
          ),

        amountPaid:
          Number(
            data.link_amount_paid ||
            0
          )

      });

    }


    catch (error) {

      console.error(
        "PAYMENT STATUS ERROR:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Unable to check payment status."

      });

    }

  }

);


// =============================================
// HOME PAGE
// =============================================

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


// =============================================
// DASHBOARD
// =============================================

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


// =============================================
// HEALTH CHECK
// =============================================

app.get(
  "/health",

  (req, res) => {

    res.json({

      success:
        true,

      message:
        "LearnNova server is running"

    });

  }

);


// =============================================
// START SERVER
// =============================================

app.listen(

  PORT,

  () => {

    console.log(
      "===================================="
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
      "===================================="
    );

  }

);
