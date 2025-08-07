#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

try {
  function generateLlmsTxt() {
    const pagesDir = path.join(process.cwd(), 'src', 'pages');
    const publicDir = path.join(process.cwd(), 'public');
    const distDir = path.join(process.cwd(), 'dist');

    try {
      // Simple fallback content
      const llmsContent = `/\tQuiz Dangal - Home\tJoin Quiz Dangal for exciting opinion-based quizzes with real prizes!
/my-quizzes\tMy Quizzes\tView your quiz history and results
/wallet\tWallet\tManage your wallet and transactions
/profile\tProfile\tUpdate your profile information
/about-us\tAbout Us\tLearn more about Quiz Dangal
/contact-us\tContact Us\tGet in touch with our support team
/terms-conditions\tTerms & Conditions\tRead our terms and conditions
/legality\tLegality\tLegal information and compliance
/admin\tAdmin\tAdmin panel for quiz management`;

      // Write to public directory
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(path.join(publicDir, 'llms.txt'), llmsContent);
      
      // Write to dist directory if it exists
      if (fs.existsSync(distDir)) {
        fs.writeFileSync(path.join(distDir, 'llms.txt'), llmsContent);
      }

      console.log(`✅ Generated llms.txt with static content`);
    } catch (error) {
      console.error('❌ Error in generate-llms.js:', error.message);
    }
  }

  generateLlmsTxt();
} catch (error) {
  console.error('❌ Fatal error in generate-llms.js:', error.message);
  process.exit(0); // Exit gracefully without error
}
