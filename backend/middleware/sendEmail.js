const nodemailer = require('nodemailer')

exports.sendEmail = async (options)=>{

    const transporter = nodemailer.createTransport({
        host: "smtp.mailtrap.io",
        port: 2525,
        auth: {
          user: "f59480babaaa1b",
          pass: "d192808d09d47c"
        }
      });   

    const mailOptions = {
        from : process.env.SMPT_MAIL,
        to : options.email,
        subject: options.subject,
        text: options.message,
    }
    await transporter.sendMail(mailOptions);
}