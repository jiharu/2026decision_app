/**
 * Pre-extracted IQAP Major Modification Proposal Brief Data
 * Source: EXAN Coop Major Mod Brief.pdf (Template Last Updated: June 2023)
 * Structure:
 *  - Part B: Proposed Major Modification: Items 1, 2, 3
 *  - Part C: Evaluation Criteria: Items 4, 5, 6, 7, 8, 9, 10, 11
 *  - Appendixes: Items A, B
 */

const INITIAL_BRIEF_METADATA = {
  documentTitle: "IQAP Major Modifications — Proposal Brief (EXAN Co-op & Trimesterization)",
  dateSubmitted: "",
  preparedBy: "Experimental Animation (EXAN) Curriculum Committee",
  programName: "Experimental Animation (EXAN)",
  facultyArea: "Faculty of Art",
  implementationDate: "Fall 2028 (Admissions) / Fall 2029 (First Work Terms)",
  oneDriveFolderUrl: "",
  lastUpdated: new Date().toISOString()
};

const STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started", badgeClass: "status-not-started" },
  { value: "needs_data", label: "Needs Data / Info Requested", badgeClass: "status-needs-data" },
  { value: "delegate_chair", label: "Delegate to Chair / Other Unit", badgeClass: "status-delegate" },
  { value: "drafting", label: "Draft in Progress", badgeClass: "status-drafting" },
  { value: "finalized", label: "Finalized", badgeClass: "status-finalized" }
];

const INITIAL_ITEMS = [
  // =========================================================================
  // PART I (Part B: PROPOSED MAJOR MODIFICATION) — Items 1, 2, 3
  // =========================================================================
  {
    id: "item-1",
    code: "1",
    sectionId: "part1",
    sectionLabel: "Part B: Proposed Major Modification",
    shortTitle: "Program Background, Modification Description & Rationale",
    status: "drafting",
    questionHtml: `<p><strong>1.</strong> Provide a brief background of the existing program, a detailed description of the proposed modification(s), and rationale for the change. Consider how the change reflects the ongoing evolution of the discipline, and responds to the changing needs of students, society and industry. If applicable, highlight any unique program or curriculum innovations.</p>`,
    existingAnswerHtml: `<p>This major modification proposes the introduction of an optional co-operative education (co-op) stream within the [insert program name] undergraduate program at OCAD University. The modification will integrate structured, paid work terms into the existing curriculum, enabling students to alternate periods of academic study with supervised, discipline-relevant professional placements.</p>
<p>The proposed co-op stream will modify the program by:</p>
<ul>
  <li>introducing three paid work terms (typically 12–16 weeks or 420 hours each).</li>
  <li>adjusting academic term sequencing to accommodate work-integrated learning without increasing total degree credit requirements (trimestering).</li>
  <li>adding a co-curricular (non-credit) preparatory online course focused on career readiness, workplace ethics/practices, and integrative learning.</li>
</ul>
<p>The core program curriculum, mode of delivery and emphasis on studio-based learning will remain intact; by integrating meaningful work opportunities, co-op will extend student learning into applied contexts.</p>
<p>The co-op stream will enhance program learning by including:</p>
<ul>
  <li>application of disciplinary knowledge in professional and community contexts.</li>
  <li>further development of entrepreneurial, collaborative and project management competencies.</li>
  <li>strengthened career literacy and professional self-efficacy.</li>
</ul>
<p>For students in the co-op stream, this modification will:</p>
<ul>
  <li>provide structured access to paid, discipline-relevant employment opportunities.</li>
  <li>reduce financial barriers through compensated work terms.</li>
  <li>increase confidence, professional networks and career clarity.</li>
  <li>enable students to graduate with demonstrable professional experience and relationships.</li>
</ul>
<p>The student experience will remain studio-centred and critically engaged, while gaining a scaffolded bridge to professional practice after graduation. This aligns particularly well with OCAD U’s long-standing culture of community engagement and applied creative production.</p>
<p>As AI technologies disrupt multiple sectors, there is the potential to impact the availability and/or professional expectations of entry- and junior-level positions. The introduction of co-op placements to the program’s curriculum will help students to engage with rapidly evolving industry and community contexts while also building face to face connections with professionals in their area of study.</p>`,
    grayZoneSubItems: [
      {
        id: "gz-1-1",
        prompt: "[Provide a brief background of the existing program including any recent curricular developments and innovations. You may want to include any special characteristics of the program that align with studio and project-based learning, applied research, community engagement and industry connections, or entrepreneurship. You might refer to section 2.1 of a recent IQAP self-study brief for relevant language.]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      },
      {
        id: "gz-1-2",
        prompt: "[Also include any changes within the discipline that might pertain to the effectiveness of or need for co-op work placement]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ],
    attachments: []
  },
  {
    id: "item-2",
    code: "2",
    sectionId: "part1",
    sectionLabel: "Part B: Proposed Major Modification",
    shortTitle: "Consultation with Academic & Support Units",
    status: "delegate_chair",
    questionHtml: `<p><strong>2.</strong> Summarize the <strong>consultation</strong> undertaken with relevant academic units, including commentary on the impact of the proposed modification(s) on other programs. Consultation should include the academic leadership of other Faculties that offer courses required or elective in the program, Budget &amp; Planning and Institutional Analysis, Admissions &amp; Recruitment (e.g. regarding timeline of implementation and communication), and the heads of support units such as the Library, Registrar (including Advising), IT Services, Facilities &amp; Studio Services, Centre for Emerging Artists and Designers and the Faculty &amp; Curriculum Development Centre, as applicable.</p>`,
    existingAnswerHtml: `<p>To explore the feasibility of co-op streams within programs at OCAD U and to support the preparation of the Letter of Intent (LOI), there were rigorous consultation conducted with a range of university stakeholders between October 2025 – present, including:</p>
<ul>
  <li>Office of the Vice-President, Academic &amp; Provost (Director, Academic Affairs &amp; Senate Secretary and Vice-President, Academic &amp; Provost)</li>
  <li>Office of the Registrar (University Registrar &amp; Director, Enrolment Services)</li>
  <li>Centre for Learning &amp; Teaching (Director, Teaching &amp; Learning)</li>
  <li>International Student Support (Manager, International Student Support)</li>
  <li>Admissions &amp; Recruitment (Director, Learning Pathways and Director, Admissions)</li>
  <li>Financial Aid &amp; Awards (Associate Registrar)</li>
  <li>RBC Centre for Emerging Artists &amp; Designers (Director)</li>
  <li>Faculty of Art (Interim Dean)</li>
  <li>Faculty of Design (Dean)</li>
  <li>Faculty of Arts &amp; Science (Acting Dean)</li>
  <li>OCAD Student Union (Executive Director of Academic Affairs)</li>
  <li>SIS &amp; Process Optimization (Director)</li>
  <li>Office of the Dean of Students (Dean of Students)</li>
  <li>Budget &amp; Planning (Executive Director, Institutional Analysis &amp; Budget Planning)</li>
</ul>
<p>These initial consultations have informed the co-op program design as reflected in the LOI, as well as a range of implementation considerations.</p>
<p>In September of 2026, a steering committee was established to provide on-going support and guidance to teams designing co-op streams within existing program and to guide co-op implementation and operations. The Co-Operative Education Program Steering Committee membership includes:</p>
<ul>
  <li>Vice Provost, Students and International (Chair)</li>
  <li>Director, Centre for Emerging Artists and Designers</li>
  <li>Director, Teaching and Learning</li>
  <li>Dean, Faculty of Design</li>
  <li>Interim Dean, Faculty of Art</li>
  <li>University Registrar</li>
  <li>Program Chair, Advertising</li>
  <li>Program Curriculum Committee Chair, Experimental Animation</li>
  <li>Program Chair, Graphic Design</li>
  <li>Program Chair, Industrial Design</li>
  <li>Curriculum Specialist, Quality Assurance</li>
  <li>Quality Assurance Officer &amp; Associate Senate Secretary</li>
</ul>`,
    grayZoneSubItems: [
      {
        id: "gz-2-1",
        prompt: "[add any program specific consultations, including program and faculty level curriculum committee discussion etc. In the case that course offerings are being changed in this major mod, Chairs of affected programs should also be consulted]",
        primaryAssignee: "Program Chair & EXAN Curriculum Committee",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      },
      {
        id: "gz-2-2",
        prompt: "[add description of further consultation with IT Services, the Library, Student Accessibility Services (SAS), Studio Services, and the Centre for Learning & Teaching (CLT) regarding the proposed curriculum changes, including considerations related to the capacity of academic and student support units to accommodate anticipated increases in enrollment and the expanded use of services during the Spring/Summer term under the trimestered model.]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ],
    attachments: []
  },
  {
    id: "item-3",
    code: "3",
    sectionId: "part1",
    sectionLabel: "Part B: Proposed Major Modification",
    shortTitle: "Student & Alumni Consultation and Transition Pathways",
    status: "needs_data",
    questionHtml: `<p><strong>3.</strong> Describe how current students and recent graduates of the program were consulted on the proposed modification and include a statement on the way in which the major modification will impact or improve the <strong>student experience</strong>. Explain in detail plans to ensure a smooth transition for current students. As appropriate, in consultation with the Office of the Registrar, map transition pathways for all categories of students: full-time, part-time, those off the model route, those with accommodations, etc.</p>`,
    existingAnswerHtml: `<p>The co-op stream will help to meet demand for existing experiential- and work-integrated learning which is currently more than double the current capacity. For example, the waitlists for existing large-enrolment placement courses in the Faculty of Design and Faculty of Art are routinely at the same level as available seats. The volume of for-credit experiential learning placements in 2025-26 was 350, a record high and an overall increase of 10% over 2024-25 (the previous record high).</p>
<p>In October of 2026, a student focus group was facilitated by the Centre for Learning &amp; Teaching (CLT), which included students and alumni from four programs proposing a co-op stream.</p>
<p>The program will begin accepting applicants to the co-op stream in 2028. Students selected for co-op will begin placements in their second year. Current students will not be affected by the change and will not have access to the co-op stream, but will maintain access to the existing range of curricular and co-curricular experiential learning opportunities at OCAD U. Even after the co-op stream starts accepting students, the program will maintain placement and other experiential learning opportunities for program students outside the co-op stream.</p>
<p>Students undertaking the co-op stream within the program will have access to the same studio, community, research and learning opportunities as their non-co-op counterparts. From a student perspective, the biggest difference between the program experience will be three paid work placement terms of 12 weeks each alternating with their semesters of study. These placements will occur in Fall, Winter and Summer terms, and students will be engaged in either a study or work period for three terms each year. This will differ from an experience where two terms of study is followed by a summer away from study. While this is often considered the norm for post-secondary students, it should be noted that many students already deviate from the fall/winter study model by taking courses in the spring and summer, taking semesters or even full years off from their studies to work or meet family obligations. Other students study part time, volunteer or work over the summer, take a semester or year abroad, etc. As such, the co-op stream will provide another model for a post-secondary experience among many possible models.</p>
<p>Co-op and non-co-op stream students will not be divided into separate cohorts within the program. Students within and outside the co-op stream will share courses and other learning opportunities at OCAD U. It is expected that students outside the co-op stream will benefit from the experiences and reflections co-op students share within course discussions and other meetings.</p>
<p>To better facilitate co-op placements, the program will shift to a trimester schedule offering three distinct terms per year. While three 12-week terms are currently offered at OCAD U, not all programs and students make use of the Spring/Summer term. Under the trimestered model, the program will offer required courses, across multiple terms, creating greater flexibility for students. This added flexibility benefits all students, not only those in the co-op stream — for example, students who need to retake a course, who enter in Winter term, who want to accelerate progress through the program, or who transfer to the program after first year will have more opportunities to do so without waiting a full year for a required course to be offered again.</p>`,
    grayZoneSubItems: [
      {
        id: "gz-3-1",
        prompt: "[add any program-specific student consultation and program-specific plans to support students; add summary of student focus group findings below]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      },
      {
        id: "gz-3-2",
        prompt: "[Insert summary of focus group findings and description of how the findings have informed program design and proposed curriculum changes.]",
        primaryAssignee: "CLT / Program Curriculum Committee",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ],
    attachments: []
  },

  // =========================================================================
  // PART II (Part C: EVALUATION CRITERIA) — Items 4 to 11
  // =========================================================================
  {
    id: "item-4",
    code: "4",
    sectionId: "part2",
    sectionLabel: "Part C: Evaluation Criteria",
    shortTitle: "Alignment with University Mission & Academic Plans",
    status: "not_started",
    questionHtml: `<p><strong>4.</strong> Describe how the proposed modification(s) aligns with the <strong>University’s mission and academic plans</strong>?</p>`,
    existingAnswerHtml: `<p>The proposed co-op stream strengthens OCAD U’s positioning as Canada’s premier art and design university by integrating professional experience directly into creative degree pathways - a model increasingly sought by prospective students and employers alike.</p>
<p>This major modification aligns strongly with OCAD University’s mission to advance art and design education that drives positive social, cultural, environmental, and economic impact.</p>
<p>Specifically, the co-op stream supports:</p>
<p><strong>Driving positive impact</strong> by embedding students in creative industries, cultural organizations, community initiatives, and entrepreneurial contexts. Co-op placements will provide students with meaningful opportunities to apply their learning in professional settings while strengthening OCAD University's relationships with industry and community partners over time.</p>
<p><strong>Innovation in learning and teaching</strong> through the integration of structured work-integrated learning with OCAD U's longstanding commitment to studio-based education. Co-op extends learning beyond the classroom and studio, enabling students to connect disciplinary knowledge with professional practice through sustained experiential learning. By launching comprehensive co-op education in the creative disciplines, OCAD U will also be well-placed to provide sector-wide art and design education leadership in this area.</p>
<p><strong>Student-centred approaches</strong> by expanding access to meaningful, paid employment opportunities that support career exploration, professional growth, and financial sustainability during students' studies. The co-op stream responds directly to student interest in gaining practical experience while completing their degree.</p>
<p><strong>Advancing equity, accessibility, and inclusion</strong> by creating paid experiential learning pathways that can help reduce barriers to participation in professional opportunities. Co-op placements will support students in developing the skills, confidence, networks, and professional experience needed to navigate diverse workplace and community environments.</p>
<p><strong>Strengthening community and partnership development</strong> by fostering ongoing collaboration between OCAD University and a broad range of employers, cultural organizations, non-profits, and community partners. These relationships will create new opportunities for student learning while contributing to knowledge exchange and community engagement.</p>
<p><strong>Supporting enrolment growth and long-term sustainability</strong> by enhancing the distinctiveness and competitiveness of OCAD U programs. Co-op participation will help students graduate with professional experience, expanded networks, and increased career readiness, strengthening the value proposition of an OCAD U education for prospective students.</p>`,
    grayZoneSubItems: [
      {
        id: "gz-4-1",
        prompt: "[Committee review of pre-filled University Mission & Equity alignment — e.g., ensuring non-co-op stream students retain equitable access to campus employment, grants, and emergency aid]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ],
    attachments: []
  },
  {
    id: "item-5",
    code: "5",
    sectionId: "part2",
    sectionLabel: "Part C: Evaluation Criteria",
    shortTitle: "Admissions & Program Requirements / Sequencing Changes",
    status: "needs_data",
    questionHtml: `<p><strong>5.</strong> Describe any changes of the proposed modification(s) to the <strong>admissions and/or program requirements</strong>. Explain how the proposed changes are in alignment with the relevant program-level learning outcomes. Include a revised program guide indicating changes to the program structure, including new courses and courses no longer required, research components, and required or elective courses provided by other units; describe any experiential or other applied learning opportunities that are part of the new or revised program component.</p>`,
    existingAnswerHtml: `<p>Students within and outside the co-op stream will maintain the same requirements for specifically required courses, electives, and degree requirements.</p>
<p>Prior to starting their first co-op placement students will participate in a non-credit online course to support their success in the placement.</p>
<p>See program guides in Appendix A.</p>`,
    grayZoneSubItems: [
      {
        id: "gz-5-1",
        prompt: "[description of admission processes to be added upon further consultation]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      },
      {
        id: "gz-5-2",
        prompt: "[add a description of any proposed changes in program-level course requirements or sequencing while ensuring that the academic (i.e. credit) requirements for both streams should remain the same]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ],
    attachments: []
  },
  {
    id: "item-6",
    code: "6",
    sectionId: "part2",
    sectionLabel: "Part C: Evaluation Criteria",
    shortTitle: "Program Learning Outcomes (PLOs) & DLE Alignment",
    status: "not_started",
    questionHtml: `<p><strong>6.</strong> Describe any changes to the <strong>program learning outcomes</strong> in the proposed modification(s), demonstrating how the changes are consistent with OCAD University’s Undergraduate or Graduate Degree Level Expectations. Inclusion of a curriculum map is recommended for significant changes.</p>`,
    existingAnswerHtml: `<p>Program Learning Outcomes will remain consistent for co-op and non-co-op students, reflecting the intentional design of co-op to enrich and extend, rather than replace, existing curriculum. As all students, regardless of stream, continue to meet the program's PLOs and the associated Undergraduate Degree Level Expectations (DLEs), the proposed modification does not alter the program's alignment with the DLE framework. However, the co-op stream offers an enhanced opportunity for students to reinforce and deepen the 'Autonomy and Professional Capacity' DLE category in particular, through sustained, supervised experience operating independently in a professional work setting — managing responsibilities, exercising professional judgement, and engaging in self-directed learning and reflection beyond the structure of the classroom or studio.</p>
<p>See curriculum map in Appendix B.</p>`,
    grayZoneSubItems: [
      {
        id: "gz-6-1",
        prompt: "[Verify PLO alignment and coordinate with Appendix B Curriculum Map creation]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ],
    attachments: []
  },
  {
    id: "item-7",
    code: "7",
    sectionId: "part2",
    sectionLabel: "Part C: Evaluation Criteria",
    shortTitle: "Mode of Delivery & Class Formats",
    status: "not_started",
    questionHtml: `<p><strong>7.</strong> Describe any changes to the program’s <strong>mode of delivery</strong> (e.g., online, synchronous/asynchronous, multi-campus, inter-institutional collaboration, etc.) or class formats and how the changes are appropriate to facilitate the successful completion of the learning outcomes.</p>
<p>Where the mode of delivery of a program is being changed to online for all or a significant portion of a program, specific commentary must be provided on the following:</p>
<ol type="a">
  <li>maintenance of and/or changes to the program objectives and program level outcomes;</li>
  <li>adequacy of technological platform and tools;</li>
  <li>sufficiency of support services and training for teaching staff;</li>
  <li>sufficiency and type of support for students in the new learning environment; and</li>
  <li>adequacy of provisions to ensure access for students, including access to technology, internet services, course materials and accessibility supports.</li>
</ol>`,
    existingAnswerHtml: `<p>The program’s mode of delivery will remain unchanged, focusing on high-quality in person program delivery and making use of OCAD U’s studios, labs and learning spaces. Co-op placements will include in-person hands-on work and learning experiences while the structure for delivering resources, assessing reflection, and supporting student needs will build on existing experiential learning models using the Canvas LMS. The Canvas platform, already familiar to students and faculty, is an effective home for tools, resources and deliverables, student and employer guides, student advising options, a job board, preparatory workshops, internal forms for placements, risk management features such as comprehensive partner and student agreements, goal-setting and reflection requirements.</p>`,
    grayZoneSubItems: [
      {
        id: "gz-7-1",
        prompt: "[Committee review of Mode of Delivery, Canvas LMS usage, and non-credit preparatory online course integration]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ],
    attachments: []
  },
  {
    id: "item-8",
    code: "8",
    sectionId: "part2",
    sectionLabel: "Part C: Evaluation Criteria",
    shortTitle: "Methods of Assessment of Teaching & Learning",
    status: "not_started",
    questionHtml: `<p><strong>8.</strong> Describe the impact of the proposed modification(s) on <strong>methods of assessment of teaching and learning</strong> and how these methods help students to achieve the program learning outcomes.</p>`,
    existingAnswerHtml: `<p>Methods of assessment of teaching and learning in courses will remain unchanged in the program. The program’s current focus on project-based learning, critique and collaborative learning will position students to thrive in work placements. Through their work term placements, students will have opportunities to reflect on their experience, creating important connections to their lived experience and courses at OCAD U. Students will receive feedback through established practices in the sector including employer evaluations of student performance and work term reflections and reports managed online through the Canvas LMS.</p>`,
    grayZoneSubItems: [
      {
        id: "gz-8-1",
        prompt: "[Committee review of work-term reflection/evaluation assessment methods and alignment with studio project continuity]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ],
    attachments: []
  },
  {
    id: "item-9",
    code: "9",
    sectionId: "part2",
    sectionLabel: "Part C: Evaluation Criteria",
    shortTitle: "Faculty Knowledge, Expertise & Industry/Community Partnerships",
    status: "delegate_chair",
    questionHtml: `<p><strong>9.</strong> Describe <strong>how the current knowledge and expertise of faculty will meet the needs of the proposed modification(s)</strong> and describe any other faculty or instructional staff implications for the proposed changes.</p>`,
    existingAnswerHtml: `<p>The Centre for Emerging Artists &amp; Designers (CEAD) is uniquely positioned within OCAD U to expand on its programs and services with the addition of a co-operative education office. For the past 13 years, the CEAD has supported all students and recent graduates with centralized and specialized career development, experiential- and work-integrated learning and creative entrepreneurship programs and services. In addition to modernizing, expanding and innovating key offerings, the CEAD led the development of OCAD U’s Experiential Learning Placement Program Policy and has supported thousands of successful student placements and developed and stewarded hundreds of sustained employer partnerships.</p>`,
    grayZoneSubItems: [
      {
        id: "gz-9-1",
        prompt: "[describe any faculty partnership with industry or community organization here]",
        primaryAssignee: "Program Chair & CEAD",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ],
    attachments: []
  },
  {
    id: "item-10",
    code: "10",
    sectionId: "part2",
    sectionLabel: "Part C: Evaluation Criteria",
    shortTitle: "Anticipated Impacts on Resource Requirements (a–d)",
    status: "needs_data",
    questionHtml: `<p><strong>10.</strong> Describe the anticipated impacts on <strong>resource requirements</strong>. Include:</p>
<ol type="a">
  <li>Expected impacts on <strong>enrollment</strong>;</li>
  <li>Required changes to the quality or quantity of <strong>support resources</strong>, such as library resources, information technology resources, studio/lab access/support, space requirements, or equipment;</li>
  <li>Changes to <strong>student support service</strong> requirements (e.g. advising, accessibility);</li>
  <li>Changes to <strong>human resource requirements</strong> not noted in 9, above</li>
</ol>`,
    existingAnswerHtml: `<p><strong>a. Expected impacts on enrollment</strong><br>
Given the high student interest and demand for experiential learning and work placement opportunities, it is projected that overall enrollment in the program will rise. The goal is to eventually include 50% of program students in a co-op stream, with an accompanying moderate increase in overall students in the program.</p>
<p><strong>d. Changes to human resource requirements not noted in 9, above</strong><br>
Implementation will require:</p>
<ul>
  <li>Dedicated Co-op Program Coordinator(s) to oversee employer development, student advising, work-term approvals, and quality assurance;</li>
  <li>Business Development support for strategic employer relations and reporting;</li>
  <li>Supervision</li>
</ul>
<p>Where possible, these functions will leverage and integrate with the RBC Centre for Emerging Artists &amp; Designer’s existing responsibilities for career development, experiential learning, and creative entrepreneurship programming. Current institutional strengths in industry partnership development and employer engagement and risk management provide a strong foundation that reduces the need for entirely new structures.</p>`,
    grayZoneSubItems: [
      {
        id: "gz-10-1",
        prompt: "10.b Support Resources: [consult with IT Services, the Library, Studio Services, and the CLT, about expected changes to student demand. Confirm existing resources are sufficient to accommodate the projected initial increase in demand during all three trimesters]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      },
      {
        id: "gz-10-2",
        prompt: "10.c Student Support Services: [consult with Advising, Student Accessibility Services, and the CLT, about expected changes to student demand. Confirm existing resources are sufficient to accommodate the projected initial increase in demand during all three trimesters]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      },
      {
        id: "gz-10-3",
        prompt: "10.a & 10.d Committee Assessment: 50% Enrollment Target, Placement-Rate Contingency Scenarios (100%, 90-99%, 70-89%, 50-69%, <50%), and Academic Department Section/Shop Staffing in Summer Trimester",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ],
    attachments: []
  },
  {
    id: "item-11",
    code: "11",
    sectionId: "part2",
    sectionLabel: "Part C: Evaluation Criteria",
    shortTitle: "Overall Changes to Expected Funding Requirements",
    status: "needs_data",
    questionHtml: `<p><strong>11.</strong> Provide a summary of overall changes to expected <strong>funding requirements</strong>, including changes to ongoing funding and any start-up costs. Please include a <strong>statement of availability of resources</strong> by the Dean(s) involved, with reference, as applicable, to consultations with the Office of the Vice-President, Academic and Provost</p>`,
    existingAnswerHtml: `<p><strong>Financial Resources</strong><br>
The proposed introduction of an optional co-operative education stream within select programs will require new, phased resources alongside strategic use of existing institutional infrastructure. The financial model is being evaluated on a multi-year basis and is intended to operate through a student ancillary fee based cost-recovery approach. Anticipated cost drivers include:</p>
<ul>
  <li>staffing for employer relations, student advising, placement monitoring, administration and program oversight;</li>
  <li>technology and system enhancements to support placement tracking, reporting and student records;</li>
  <li>development of preparatory career readiness resources;</li>
  <li>communications, training and employer engagement activities;</li>
  <li>and accessibility and student support measures associated with work-integrated learning placements.</li>
</ul>
<p>Resource requirements are expected to be phased in alignment with enrolment growth, placement demand and implementation milestones. Detailed staffing, operating and infrastructure requirements will continue to be refined through consultation with relevant academic and administrative units as planning progresses.</p>
<p><strong>Physical Resources</strong><br>
As participation in the co-operative education stream grows, appropriate workspace for co-op operations and student support will be required. Existing classrooms, studios and institutional facilities are expected to support implementation, with operational planning coordinated alongside broader institutional scheduling and trimestering discussions.</p>
<p><strong>Digital Resources</strong><br>
Existing student information systems and career services platforms will provide the foundation for implementation. Modest enhancements may be required to support employer engagement, placement administration, transcript notation, monitoring and reporting functions associated with co-operative education.</p>`,
    grayZoneSubItems: [
      {
        id: "gz-11-1",
        prompt: "[Further financial assessment may be added upon further consultation as needed]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ],
    attachments: []
  },

  // =========================================================================
  // APPENDIXES — Appendix A, Appendix B
  // =========================================================================
  {
    id: "item-app-a",
    code: "Appendix A",
    sectionId: "appendixes",
    sectionLabel: "Appendixes",
    shortTitle: "Program Guides (Non-Co-op & Co-op Streams)",
    status: "needs_data",
    questionHtml: `<p><strong>Appendix A:</strong> Program Guides (Non-Co-op &amp; Co-op Streams) and Trimester Course Sequencing</p>`,
    existingAnswerHtml: `<p><em>(Refer to Office of the Registrar’s Trimesterization &amp; Co-op Sequencing Chart and EXAN Program Guides)</em></p>`,
    grayZoneSubItems: [
      {
        id: "gz-a-1",
        prompt: "[add program guides, one for non-coop highlighting changes if any, and one for co-op.]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ],
    attachments: []
  },
  {
    id: "item-app-b",
    code: "Appendix B",
    sectionId: "appendixes",
    sectionLabel: "Appendixes",
    shortTitle: "Curriculum Map (Created with Support from CLT)",
    status: "not_started",
    questionHtml: `<p><strong>Appendix B:</strong> Program Curriculum Map</p>`,
    existingAnswerHtml: `<p><em>(Curriculum map aligning courses, Co-op work terms, Program Learning Outcomes, and DLEs)</em></p>`,
    grayZoneSubItems: [
      {
        id: "gz-b-1",
        prompt: "[add curriculum map to be created with support from CLT]",
        primaryAssignee: "",
        draftHtml: "",
        finalHtml: "",
        optionalAssignee: "",
        optionalHtml: ""
      }
    ],
    attachments: []
  }
];
