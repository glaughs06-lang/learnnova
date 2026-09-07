const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(__dirname));


// =====================================
// CASHFREE CONFIGURATION
// =====================================

const CASHFREE_BASE_URL =
  process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

const CASHFREE_API_VERSION =
  "2025-01-01";


// =====================================
// COURSES
// =====================================

const courses = {

  web_development: {
    id: "web_development",
    name: "Web Development",
    amount: 499,
    icon: "💻",
    description:
      "Learn HTML, CSS, JavaScript and modern web development."
  },

  ethical_hacking: {
    id: "ethical_hacking",
    name: "Ethical Hacking",
    amount: 799,
    icon: "🛡️",
    description:
      "Learn cybersecurity, ethical hacking and security fundamentals."
  },

  digital_marketing: {
    id: "digital_marketing",
    name: "Digital Marketing",
    amount: 199,
    icon: "📈",
    description:
      "Learn social media, SEO and online marketing skills."
  },

  affiliate_marketing: {
    id: "affiliate_marketing",
    name: "Affiliate Marketing",
    amount: 149,
    icon: "🤝",
    description:
      "Learn how affiliate marketing works and how to grow online."
  }

};


// =====================================
// CASHFREE HEADERS
// =====================================

function getCashfreeHeaders() {

  return {

    "Content-Type":
      "application/json",

    "x-api-version":
      CASHFREE_API_VERSION,

    "x-client-id":
      process.env.CASHFREE_CLIENT_ID,

    "x-client-secret":
      process.env.CASHFREE_CLIENT_SECRET

  };

}


// =====================================
// GET WEBSITE BASE URL
// =====================================

function getBaseUrl(req) {

  if (
    process.env.APP_URL
  ) {

    return process.env.APP_URL
      .replace(/\/$/, "");

  }


  const protocol =
    req.get("x-forwarded-proto") ||
    req.protocol;


  return (
    protocol +
    "://" +
    req.get("host")
  );

}


// =====================================
// CHECK ENVIRONMENT VARIABLES
// =====================================

function checkCashfreeKeys(
  req,
  res,
  next
) {

  if (
    !process.env.CASHFREE_CLIENT_ID ||
    !process.env.CASHFREE_CLIENT_SECRET
  ) {

    return res.status(500).json({

      success: false,

      error:
        "Cashfree API keys are not configured"

    });

  }


  next();

}


// =====================================
// CREATE PAYMENT LINK
// =====================================

app.post(
  "/create-payment-link",
  checkCashfreeKeys,
  async (req, res) => {

    try {

      const {

        courseId,
        customerName,
        customerEmail,
        customerPhone

      } = req.body;


      // ---------------------------------
      // VALIDATE COURSE
      // ---------------------------------

      const course =
        courses[courseId];


      if (!course) {

        return res.status(400).json({

          success: false,

          error:
            "Invalid course selected"

        });

      }


      // ---------------------------------
      // VALIDATE CUSTOMER
      // ---------------------------------

      if (
        !customerName ||
        !customerPhone
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Name and mobile number are required"

        });

      }


      let cleanPhone =
        String(
          customerPhone
        ).replace(
          /\D/g,
          ""
        );


      if (
        cleanPhone.length === 12 &&
        cleanPhone.startsWith(
          "91"
        )
      ) {

        cleanPhone =
          cleanPhone.substring(2);

      }


      if (
        cleanPhone.length !== 10
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Please enter a valid 10 digit mobile number"

        });

      }


      // ---------------------------------
      // UNIQUE PAYMENT LINK ID
      // ---------------------------------

      const linkId =
        "LN_" +
        Date.now() +
        "_" +
        crypto
          .randomBytes(4)
          .toString("hex");


      const baseUrl =
        getBaseUrl(req);


      // ---------------------------------
      // PAYMENT SUCCESS RETURN URL
      // ---------------------------------

      const returnUrl =
        baseUrl +
        "/payment-success?link_id=" +
        encodeURIComponent(
          linkId
        );


      // ---------------------------------
      // CASHFREE PAYMENT DATA
      // ---------------------------------

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
            customerName,

          customer_email:
            customerEmail ||
            "",

          customer_phone:
            cleanPhone

        },


        // ---------------------------------
        // SAVE COURSE DETAILS
        // ---------------------------------

        link_notes: {

          course_id:
            course.id,

          course_name:
            course.name

        },


        // ---------------------------------
        // RETURN TO LEARNNOVA
        // ---------------------------------

        link_meta: {

          return_url:
            returnUrl

        },


        // ---------------------------------
        // DON'T SEND EXTRA SMS/EMAIL
        // ---------------------------------

        link_notify: {

          send_sms:
            false,

          send_email:
            false

        }

      };


      console.log(
        "Creating Cashfree payment link:",
        linkId
      );


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
        "Cashfree create response:",
        cashfreeData
      );


      // ---------------------------------
      // HANDLE CASHFREE ERROR
      // ---------------------------------

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

            "Unable to create payment link"

        });

      }


      // ---------------------------------
      // SUCCESS
      // ---------------------------------

      return res.json({

        success:
          true,

        paymentLink:
          cashfreeData.link_url,

        linkId:
          linkId,

        course:
          course,

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

        success:
          false,

        error:
          "Payment server error. Please try again."

      });

    }

  }
);


// =====================================
// VERIFY PAYMENT WITH CASHFREE
// =====================================

app.get(
  "/verify-payment/:linkId",

  checkCashfreeKeys,

  async (req, res) => {

    try {

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

            headers:
              getCashfreeHeaders()

          }

        );


      const data =
        await response.json();


      console.log(
        "Cashfree verification response:",
        data
      );


      if (
        !response.ok
      ) {

        return res.status(
          response.status
        ).json({

          success:
            false,

          error:

            data.message ||

            "Unable to verify payment"

        });

      }


      // ---------------------------------
      // PAYMENT MUST BE PAID
      // ---------------------------------

      if (
        data.link_status !==
        "PAID"
      ) {

        return res.json({

          success:
            false,

          paid:
            false,

          status:
            data.link_status ||

            "UNKNOWN"

        });

      }


      // ---------------------------------
      // GET COURSE FROM CASHFREE NOTES
      // ---------------------------------

      const courseId =
        data.link_notes?.course_id;


      const course =
        courses[courseId];


      if (!course) {

        return res.status(500).json({

          success:
            false,

          error:
            "Course information could not be found"

        });

      }


      // ---------------------------------
      // SUCCESS
      // ---------------------------------

      return res.json({

        success:
          true,

        paid:
          true,

        status:
          "PAID",

        linkId:
          data.link_id,

        course:
          course,

        customer: {

          name:
            data.customer_details
              ?.customer_name ||
            "",

          email:
            data.customer_details
              ?.customer_email ||
            "",

          phone:
            data.customer_details
              ?.customer_phone ||
            ""

        }

      });

    }


    catch (error) {

      console.error(
        "VERIFY PAYMENT ERROR:",
        error
      );


      return res.status(500).json({

        success:
          false,

        error:
          "Unable to verify payment"

      });

    }

  }
);


// =====================================
// PAYMENT SUCCESS
// CASHFREE RETURNS HERE
// =====================================

app.get(
  "/payment-success",

  async (req, res) => {

    const linkId =
      req.query.link_id;


    if (!linkId) {

      return res.redirect(
        "/dashboard?payment=missing"
      );

    }


    // ---------------------------------
    // AUTOMATIC DASHBOARD REDIRECT
    // ---------------------------------

    return res.redirect(

      "/dashboard?link_id=" +

      encodeURIComponent(
        linkId
      )

    );

  }
);


// =====================================
// DASHBOARD PAGE
// =====================================

app.get(
  "/dashboard",

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

      "LearnNova running on port " +
      PORT

    );

  }

);
