// app/privacy-policy/page.tsx
import React from "react";

export const metadata = {
  title: "Privacy Policy | Rubikiai Lux",
};

const POLICY = `Rubikiai Lux (hereinafter—the Privacy Policy) defines the conditions that all visitors to the website
www.Rubikiailux.lt (hereinafter—the Website) must follow. All listed conditions apply each time a visitor
uses the content created by Rubikiai Lux, purchases a service/product, or sends an inquiry—regardless of
whether a computer, tablet, phone, or other device is used.
A Visitor is deemed to have read and confirmed agreement to abide by the Privacy Policy when they visit
the Website, log in to the Website, and/or purchase a product and/or service sold on the Website. A Visitor
who does not agree with any provision of the Privacy Policy does not confirm their consent and loses the
right to visit the Website, log in, and use all and/or any of the services provided on the Website.
Persons under the age of 16 may not provide any personal data via our website. If you are under 16, you
must obtain consent from your parents or legal guardians before providing personal information.
Rubikiai Lux (hereinafter—the Data Controller) sets the conditions for processing personal data when
using the website managed by the Data Controller. The conditions set out in the Privacy Policy apply
whenever a Visitor wishes to access the content and/or services provided by the Data Controller,
regardless of the device (computer, mobile phone, tablet, TV, etc.) used.
This Policy does not apply when a Visitor browses other companies’ websites or uses third-party services
while visiting the Rubikiai Lux website.
When processing personal data, we follow the requirements of the EU General Data Protection Regulation
No. 2016/679, the Law on Legal Protection of Personal Data of the Republic of Lithuania, the Law on
Electronic Communications of the Republic of Lithuania, other relevant legal acts, and the instructions of
supervisory authorities.
DATA CONTROLLER DETAILS:
Tel.: +370 646 32 972
Email: info@rubikiailux.lt
WHAT INFORMATION ABOUT THE VISITOR IS COLLECTED?
Directly provided information:
First name
Last name
Email address
Phone number

INFORMATION ON HOW THE VISITOR USES OUR WEBSITE:
If a Visitor browses the Data Controller’s website, the Data Controller also collects information that
reveals the usage patterns of the services provided or automatically generates visit statistics. More in the
“Cookies” section.
INFORMATION FROM THIRD PARTIES:
When a Visitor logs in via social network accounts such as Facebook, Gmail, etc., information received
may be linked to other information we obtain when the Visitor uses our website.
OTHER INFORMATION WE COLLECT:
Information about the Visitor’s computer and their visits and use of this Website, including IP address,
login time and date;
Any other information the Visitor may provide to the Data Controller at any time while using the Data
Controller’s Website and services.
VISITOR RIGHTS:
A Visitor who has agreed to this Privacy Policy has the right to:
• Know and be informed about the processing of their personal data;
• Familiarize themselves with the data processing policy;
• Suspend processing of their data (except storage);
• Object to their data being processed or used for direct marketing purposes, including profiling insofar as
it relates to direct marketing.
WHEN DO WE USE THE VISITOR’S INFORMATION?
The personal information provided by the Visitor may be used for:
• Allowing access to the rubikiailux.lt website and services provided on it;
• Direct marketing purposes with the Visitor’s consent (sending newsletters, individual notices about
promotions and special offers, conducting surveys to learn opinions about services);*
• Direct marketing—profiling, to offer individually tailored offers and services to the Visitor;*
• Sending invoices and reports;
• Payment for services (shopping cart) via the selected external banking service provider;
• Analyzing how many people use our online services and how they do so, in order to improve service
quality and content.
The Visitor has the right to withdraw consent for the use of their data for marketing purposes at any time.
TO WHOM DO WE DISCLOSE VISITOR INFORMATION?
We undertake not to transfer the Visitor’s personal data to any unrelated third parties, except:
• If the Visitor agrees to disclose their personal data and confirms this in writing;
• When providing services—to our partners when services are ordered. The Data Controller will provide
service providers only as much of the Visitor’s personal information as is necessary to perform the
specific service;
• To law enforcement authorities in accordance with the procedures established by the laws of the
Republic of Lithuania.
HOW LONG IS VISITOR DATA STORED?
Rubikiai Lux stores the Visitor’s personal data no longer than required by the purposes of data processing
or as provided by law, if a longer retention period is established. Personal data is usually stored as long as
reasonable claims may arise from contractual relations or to the extent necessary to implement and protect
Rubikiai Lux’s legitimate interests. Unnecessary personal data is destroyed. When providing electronic
services, Rubikiai Lux processes traffic data only to the extent necessary to ensure proper service
provision, except in cases established by law.
NEWSLETTERS
By subscribing to the newsletter, Rubikiai Lux uses the Visitor’s email address based on the Visitor’s
consent, which can be withdrawn at any time. We may transfer the Visitor’s email address to third parties
providing specialized services solely for the purpose of sending the Rubikiai Lux newsletter to you.
After sending a newsletter, Rubikiai Lux may collect statistical data about Visitor behavior, e.g., whether

the email was opened and which links were clicked.
We will process the Visitor’s email address for the purpose of sending newsletters until the Visitor opts
out of receiving Rubikiai Lux offers. You can unsubscribe at the bottom of the newsletter by clicking the
relevant link or by other means indicated in this Policy.
INFORMATION PROVIDED TO THIRD PARTIES
The Data Controller’s website may contain advertisements, links to third-party websites and services—
which the Data Controller does not control. The Data Controller is not responsible for the security and
privacy of information collected by third parties. The Visitor must read the privacy provisions applied by
the third-party websites and services they use.
FINAL PROVISIONS
The Data Controller has the right to partially or completely change the Policy.
Additions or changes to the Privacy Policy take effect from the day they are published on the Website.
If, after the Policy has been supplemented or changed, the Visitor continues to use the Website and its
services and confirms consent, it is considered that the Visitor agrees with these additions and/or changes.
This Policy is reviewed at least once every two (2) years and updated as necessary.
COOKIE USE
When visiting the Data Controller’s website, content must be presented that meets the Visitor’s needs.
Cookies are necessary for this process—information elements that automatically save Visitor data while
browsing the website. They help retain browsing history, adapt content accordingly, allow monitoring of
time spent on the site, collect statistics about visitor numbers, and ensure smooth website operation.
To analyze the use of the Website, Rubikiai Lux uses Google Analytics and other similar tools. These
tools generate statistics and other information about website use based on cookies stored on users’
computers. Information collected about visits to the Website is used to create reports on website usage.
DISPUTE RESOLUTION
Disputes out of court are examined under the Law on Consumer Protection of the Republic of Lithuania
by the State Consumer Rights Protection Authority, Vilniaus g. 25, 01402 Vilnius, email tarnyba@vvtat.lt,
tel. (8 5) 262 67 51, fax (8 5) 279 1466, website www.vvtat.lt. You can submit a request electronically via
the ODR platform at http://ec.europa.eu/odr/`;

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-[var(--color-background-main)] min-h-screen">
      <section className="max-w-4xl mx-auto px-6 md:px-8 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-primary-dark)]">
          Privacy Policy
        </h1>

        <div className="mt-6 rounded-2xl border border-neutral-200 bg-white shadow-sm p-6 md:p-8">
          <pre className="whitespace-pre-wrap font-sans text-[15px] leading-7 text-neutral-800">
            {POLICY}
          </pre>
        </div>
      </section>
    </main>
  );
}
