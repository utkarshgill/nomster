import React from 'react';

const Privacy = () => {
    return (
        <div style={{ backgroundColor: '#fff', padding: '40px', margin: '20px', borderRadius: '28px' }}>
            <h1>Privacy Policy for Nomster</h1>
            <h2>Introduction</h2>
            <p>At Nomster, your privacy is paramount to us. We understand that your personal information is your own, and we're committed to protecting it. This Privacy Policy outlines our practices for collecting, using, and disclosing your information.</p>

            <h2>Information We Collect</h2>
            <p>We collect the following categories of information:</p>
            <ul>
                <li>Email: Used for identification, authentication, and marketing communications.</li>
                <li>OpenID: Utilized for secure sign-in across multiple platforms.</li>
                <li>Profile Information: Includes your name, profile picture, and preferences to provide a personalized experience.</li>
            </ul>

            <h2>How We Use Your Information</h2>
            <p>We utilize the collected information to:</p>
            <ul>
                <li>Provide and improve our services.</li>
                <li>Send notifications about updates and offers.</li>
                <li>Maintain security and fraud prevention.</li>
                <li>Comply with legal obligations.</li>
            </ul>

            <h2>Sharing Your Information</h2>
            <p>We do not sell your personal information. We may share your information with trusted third-party vendors solely for purposes directly related to our services, such as payment processing.</p>

            <h2>Your Rights</h2>
            <p>You have the right to access, modify, or delete your personal information at any time. You can contact us at support@nomster.in for assistance.</p>

            <h2>Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on our website.</p>
        </div>
    );
};

export default Privacy;
