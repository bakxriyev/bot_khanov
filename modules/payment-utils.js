/**
 * Generate a Payme payment link with user and course information
 * @param {string} fullName - User's full name
 * @param {string} courseName - Course name
 * @param {string} price - Course price (without spaces)
 * @returns {string} - Payme payment link
 */
export function generatePaymeLink(fullName, courseName, price) {
    // Create the payment data string
    const paymentData = `m=67efddd7ed17d6583aa3720d;ac.full_name=${fullName};ac.course=${courseName};a=${price}`;
    
    // Base64 encode the payment data
    const encodedData = Buffer.from(paymentData).toString('base64');
    
    // Return the complete payment URL
    return `http://checkout.paycom.uz/${encodedData}`;
}