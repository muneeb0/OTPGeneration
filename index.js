const express = require('express');
const app = express();
const port = 8000;
//const otpGenerator = require('otp-generator');
const sql = require("mssql");
const crypto = require('crypto');
const bodyParser = require('body-parser');
app.use(bodyParser.json());
function generateNumericOTP() {
    let otp = '';
    for (let i = 0; i < 6; i++) {
        otp += Math.floor(Math.random() * 10); // Generates a random number between 0-9
    }
    return otp;
}

const generateOtp = () => {
    return crypto.randomInt(100000, 999999).toString(); // Generates a 6-digit OTP
};


//console.log(generateOtp());


// MSSQL configuration
const config = {
    user: 'sa',
    password: '123',
    server: 'DESKTOP-JCC14TT',
    database: 'user',
    options: {
        encrypt: false, // If you are connecting to Azure SQL Database, set to true
        enableArithAbort: true
    }
};

// Async function to connect to MSSQL
async function connectToDB() {
    try {
        await sql.connect(config);
        console.log('Connected to MSSQL database');
    } catch (err) {
        console.error('Error connecting to database:', err.message);
    }
}




app.post('/generateOTP', async (req, res) => {

    console.log(req);
    let phoneNumber = req.body.phoneNumber;
    console.log(phoneNumber);
    // Generate OTP
    const otp = generateNumericOTP();

    // Store OTP in MSSQL database
    try {
         await connectToDB();
         const request = new sql.Request();
       //  const query = `INSERT INTO OTPs VALUES ('1',${otp},'','1')`;
       const insertQuery = `INSERT INTO OTPs (userId, otp, expiry, type) 
VALUES ('${phoneNumber}', ${otp}, DATEADD(MINUTE, 5, GETDATE()), '1')`;
         const result = await request.query(insertQuery);
         console.log('OTP stored successfully:', otp);
        res.status(200).json({ otp });
    } catch (err) {
        console.error('Error storing OTP:', err.message);
        res.status(500).json({ error: 'Failed to generate OTP' });
    }
});

app.post('/verify-otp', async (req, res) => {
    let phoneNumber = req.body.phoneNumber;
    const otp  = req.body.otp;

    try {
        // Connect to MSSQL database
        await connectToDB();
        const request = new sql.Request();

        // Fetch OTP and expiry for the given phone number
        const query = `SELECT otp, expiry FROM OTPs WHERE userId = '${phoneNumber}'`;
        const result = await request.query(query);
        console.log(JSON.stringify(result));

        if (result.recordset.length === 0) {
            return res.status(400).json({ message: 'No OTP generated for this phone number.' });
        }

        const storedData = result.recordset[0];
        const storedOtp = storedData.otp;
        const expiryTime = storedData.expiry;

        console.log(`store OTP : ${storedOtp}`);

        
        // if (currentTime > expiryTime) {
        //     // Delete expired OTP from the database
        //     const deleteQuery = `DELETE FROM OTPs WHERE userId = '${phoneNumber}'`;
        //     await request.query(deleteQuery);

        //     return res.status(400).json({ message: 'OTP has expired.' });
        // }

        // Check if OTP is expired
        if (new Date() > expiryTime) {
            // Delete expired OTP from database
            const deleteQuery = `DELETE FROM OTPs WHERE userId = '${phoneNumber}'`;
            await request.query(deleteQuery);

            return res.status(400).json({ message: 'OTP has expired.' });
        }
        console.log(` OTP : ${otp}`);
        // Compare stored OTP with the OTP provided by the user
        if (storedOtp == otp) {
            // OTP is valid, delete the OTP from the database
            const deleteQuery = `DELETE FROM OTPs WHERE userId = '${phoneNumber}'`;
            await request.query(deleteQuery);
            return res.status(200).json({ message: 'OTP verified successfully' });
        } else {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

    } catch (err) {
        console.error('Error verifying OTP:', err.message);
        res.status(500).json({ error: 'Failed to verify OTP' });
    }
});

app.listen(port,()=>{
    console.log(`Server is running on port ${port}`);
})