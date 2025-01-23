const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "daiduong020802@gmail.com",
    pass: "ibed uoae gnyy sodu",
  },
});

const sendVerificationEmail = async (to, token) => {
  const verificationLink = `${process.env.CLIENT_URL}/api/verify-email?token=${token}`;
  const mailOptions = {
    from: "daiduong020802@gmail.com",
    to,
    subject: "Verify your email",
    html: `
        <h1>Verify your email</h1>
        <p>Hello,</p>
        <p>Click the link below to verify your email:</p>
        <a href="${verificationLink}">Verify email</a>
      `,
  };

  await transporter.sendMail(mailOptions);
};

const sendNewPasswordEmail = async (email, newPassword) => {
  const mailOptions = {
    from: "daiduong020802@gmail.com",
    to: email,
    subject: "Your new password",
    html: `
        <p>Hello,</p>
        <p>Your new password is:</p>
        <p><strong>${newPassword}</strong></p>
        <p>Please login and change your password if needed.</p>
      `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail, sendNewPasswordEmail };
