const express = require("express");
const path = require("path");
const https = require("https");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ==========================================
// LEARNNOVA CONFIGURATION
// ==========================================

const PORT =
  process.env.PORT || 3000;


const CASHFREE_ENV =
  process.env.CASHFREE_ENV || "sandbox";


const CASHFREE_BASE_URL =
  CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";


const APP_URL =
  process.env.APP_URL ||
  "https://learnnova-1.onrender.com";


// ==========================================
// COURSES
// ==========================================

const courses = {

  web_development: {

    id:
      "web_development",

    name:
      "Web Development",

    amount:
      499

  },


  ethical_hacking: {

    id:
      "ethical_hacking",

    name:
      "Ethical Hacking",

    amount:
      799

  },


  digital_marketing: {

    id:
      "digital_marketing",

    name:
      "Digital Marketing",

    amount:
      199

  },


  affiliate_marketing: {

    id:
      "affiliate_marketing",

    name:
      "Affiliate Marketing",

    amount:
      149

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
// HTTPS REQUEST FUNCTION
// NODE 14 COMPATIBLE
// ==========================================

function cashfreeRequest(
  url,
  method,
  headers,
  body
) {

  return new Promise(

    function (
      resolve,
      reject
    ) {

      const parsedUrl =
        new URL(url);


      const options = {

        hostname:
          parsedUrl.hostname,

        path:
          parsedUrl.pathname +
          parsedUrl.search,

        method:
          method,

        headers:
          headers

      };


      const request =
        https.request(

          options,

          function (
            response
          ) {

            let responseData =
              "";


            response.on(

              "data",

              function (
                chunk
              ) {

                responseData +=
                  chunk;

              }

            );


            response.on(

              "end",

              function () {

                let data;


                try {

                  data =
                    JSON.parse(
                      responseData
                    );

                }


                catch (error) {

                  data = {

                    raw:
                      responseData

                  };

                }


                resolve({

                  status:
                    response.statusCode,

                  ok:
                    response.statusCode >= 200 &&
                    response.statusCode < 300,

                  data:
                    data

                });

              }

            );

          }

        );


      request.on(

        "error",

        function (
          error
        ) {

          reject(
            error
          );

        }

      );


      if (body) {

        request.write(
          JSON.stringify(
            body
          )
        );

      }


      request.end();

    }

  );

}


// ==========================================
// CHECK CASHFREE CONFIGURATION
// ==========================================

function checkCashfreeKeys(
  req,
  res
) {

  if (

    !process.env.CASHFREE_CLIENT_ID ||

    !process.env.CASHFREE_CLIENT_SECRET

  ) {

    res.status(
      500
    ).json({

      success:
        false,

      error:
        "Cashfree API keys are not configured in Render."

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

  async function (
    req,
    res
  ) {

    try {

      console.log(
        "================================="
      );


      console.log(
        "Payment request received"
      );


      console.log(
        req.body
      );


      console.log(
        "================================="
      );


      // CHECK CASHFREE KEYS

      if (

        !checkCashfreeKeys(
          req,
          res
        )

      ) {

        return;

      }


      const courseId =
        req.body.courseId;


      const customerName =
        req.body.customerName;


      const customerEmail =
        req.body.customerEmail;


      const customerPhone =
        req.body.customerPhone;


      // CHECK COURSE

      if (!courseId) {

        return res.status(
          400
        ).json({

          success:
            false,

          error:
            "Course ID is missing."

        });

      }


      const course =
        courses[
          courseId
        ];


      if (!course) {

        return res.status(
          400
        ).json({

          success:
            false,

          error:
            "Invalid course selected."

        });

      }


      // =================================
      // VALIDATE CUSTOMER DETAILS
      // =================================

      if (

        !customerName ||

        !customerPhone

      ) {

        return res.status(
          400
        ).json({

          success:
            false,

          error:
            "Customer name and mobile number are required."

        });

      }


      // =================================
      // CLEAN PHONE NUMBER
      // =================================

      let phone =
        String(
          customerPhone
        ).replace(
          /\D/g,
          ""
        );


      if (

        phone.length === 12 &&

        phone.startsWith(
          "91"
        )

      ) {

        phone =
          phone.substring(
            2
          );

      }


      if (

        phone.length !== 10

      ) {

        return res.status(
          400
        ).json({

          success:
            false,

          error:
            "Please enter a valid 10 digit mobile number."

        });

      }


      // =================================
      // CREATE UNIQUE LINK ID
      // =================================

      const linkId =

        "LN_" +

        Date.now() +

        "_" +

        Math.floor(
          Math.random() *
          100000
        );


      // =================================
      // CASHFREE PAYMENT DATA
      // =================================

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


          customer_phone:

            phone

        },


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


      // ADD EMAIL ONLY IF PROVIDED

      if (

        customerEmail

      ) {

        paymentData
          .customer_details
          .customer_email =

          customerEmail;

      }


      console.log(
        "Creating Cashfree payment link..."
      );


      console.log(
        "Course:",
        course.name
      );


      // =================================
      // CALL CASHFREE
      // =================================

      const cashfreeResponse =

        await cashfreeRequest(

          CASHFREE_BASE_URL +

          "/links",


          "POST",


          getCashfreeHeaders(),


          paymentData

        );


      console.log(
        "Cashfree HTTP Status:",
        cashfreeResponse.status
      );


      console.log(
        "Cashfree Response:",
        cashfreeResponse.data
      );


      // =================================
      // HANDLE CASHFREE ERROR
      // =================================

      if (

        !cashfreeResponse.ok

      ) {

        return res.status(

          cashfreeResponse.status ||

          500

        ).json({

          success:
            false,


          error:

            cashfreeResponse.data.message ||

            cashfreeResponse.data.error ||

            cashfreeResponse.data.raw ||

            "Cashfree was unable to create the payment link."

        });

      }


      const cashfreeData =
        cashfreeResponse.data;


      // =================================
      // CHECK PAYMENT LINK
      // =================================

      if (

        !cashfreeData ||

        !cashfreeData.link_url ||

        !cashfreeData.link_id

      ) {

        console.error(
          "Invalid Cashfree response:",
          cashfreeData
        );


        return res.status(
          500
        ).json({

          success:
            false,

          error:
            "Cashfree returned an invalid payment link response."

        });

      }


      // =================================
      // SUCCESS RESPONSE
      // =================================

      return res.json({

        success:
          true,


        paymentLink:

          cashfreeData.link_url,


       
