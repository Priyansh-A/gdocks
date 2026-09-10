export function getTemplateContent(type: string): string {
  switch (type) {
    case 'letter':
      return `
        <h1>Letter</h1>
        <p><strong>Date:</strong> </p>
        <p><strong>To:</strong> </p>
        <p><strong>From:</strong> </p>
        <p>Dear </p>
        <p></p>
        <p>I am writing to...</p>
        <p></p>
        <p>Sincerely,</p>
        <p></p>
      `;
    case 'report':
      return `
        <h1>Report Title</h1>
        <h2>Executive Summary</h2>
        <p></p>
        <h2>Introduction</h2>
        <p></p>
        <h2>Findings</h2>
        <ul>
          <li>Point 1</li>
          <li>Point 2</li>
          <li>Point 3</li>
        </ul>
        <h2>Conclusion</h2>
        <p></p>
      `;
    case 'blog':
      return `
        <h1>Blog Post Title</h1>
        <p><em>Published on </em></p>
        <p></p>
        <h2>Introduction</h2>
        <p></p>
        <h2>Main Content</h2>
        <p></p>
        <h2>Conclusion</h2>
        <p></p>
      `;
    case 'resume':
      return `
        <h1>John Doe</h1>
        <p><strong>Email:</strong> john@example.com | <strong>Phone:</strong> (123) 456-7890</p>
        <hr />
        <h2>Professional Summary</h2>
        <p></p>
        <h2>Work Experience</h2>
        <h3>Job Title - Company Name</h3>
        <p><em>Date - Present</em></p>
        <ul>
          <li>Responsibility 1</li>
          <li>Responsibility 2</li>
        </ul>
        <h2>Education</h2>
        <h3>Degree - University</h3>
        <p><em>Date</em></p>
        <h2>Skills</h2>
        <ul>
          <li>Skill 1</li>
          <li>Skill 2</li>
        </ul>
      `;
    case 'code':
      return `
        <h1>Code Documentation</h1>
        <h2>Overview</h2>
        <p></p>
        <h2>Code Example</h2>
        <pre><code>
          // Your code here
          function example() {
            return 'Hello World';
          }
        </code></pre>
        <h2>Explanation</h2>
        <p></p>
      `;
    default:
      return '<p>Start writing your document...</p>';
  }
}