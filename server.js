const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(__dirname));


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
// CREATE PAYMENT LINK
// =====================================

app.post(
  "/create-payment-link",
  async (req, res) => {

    try {

      const {
        courseId,
        customerName,
        customerEmail,
        customerPhone
      } = req.body;


      // CHECK KEYS

      if (
        !process.env.CASHFREE_CLIENT_ID ||
        !process.env.CASHFREE_CLIENT_SECRET
      ) {

        return res.status(500).json({

          success: false,

          error:
            "Cashfree keys are not configured on the server"

        });

      }


      // CHECK COURSE

      const course =
        courses[courseId];


      if (!course) {

        return res.status(400).json({

          success: false,

          error:
            "Invalid course selected"

        });

      }


      // CHECK PHONE

      if (
        !customerPhone ||
        customerPhone.length !== 10
      ) {

        return res.status(400).json({

          success: false,

          error:
            "Valid 10 digit phone number is required"

        });

      }


      // UNIQUE LINK ID

      const linkId =
        "LN_" +
        Date.now() +
        "_" +
        Math.floor(
          Math.random() * 100000
        );


      // WEBSITE URL

      const websiteUrl =
        "https://" +
        req.get("host");


      // PAYMENT DATA

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

        link_notify:
          true,


        link_return_url:
          websiteUrl +
          "/dashboard.html",


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
        "Creating payment link:",
        linkId
      );


      // CASHFREE REQUEST

      const cashfreeResponse =
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
                process.env.CASHFREE_CLIENT_ID,

              "x-client-secret":
                process.env.CASHFREE_CLIENT_SECRET

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
        "Cashfree create response:",
        cashfreeData
      );


      // CASHFREE ERROR

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


      // SEND RESPONSE

      return res.json({

        success: true,

        linkId:
          cashfreeData.link_id,

        paymentLink:
          cashfreeData.link_url,

        courseName:
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
          "Payment server error"

      });

    }

  }
);


// =====================================
// VERIFY PAYMENT
// =====================================

app.get(
  "/verify-payment/:linkId",

  async (req, res) => {

    try {

      const linkId =
        req.params.linkId;


      console.log(
        "Verifying payment:",
        linkId
      );


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
                process.env.CASHFREE_CLIENT_ID,

              "x-client-secret":
                process.env.CASHFREE_CLIENT_SECRET

            }

          }

        );


      const data =
        await response.json();


      console.log(
        "Cashfree verification response:",
        data
      );


      if (!response.ok) {

        return res.status(
          response.status
        ).json({

          success: false,

          error:
            data.message ||
            "Unable to verify payment"

        });

      }


      const paid =
        data.link_status === "PAID";


      // COURSE NAME

      let courseName =
        data.link_purpose ||
        "LearnNova Course";


      // REMOVE PREFIX

      if (
        courseName.startsWith(
          "LearnNova - "
        )
      ) {

        courseName =
          courseName.replace(
            "LearnNova - ",
            ""
          );

      }


      return res.json({

        success
