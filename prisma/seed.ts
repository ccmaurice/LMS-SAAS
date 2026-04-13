import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const root = process.cwd();
// If the operator preset DATABASE_URL (or DIRECT_URL), do not let `.env.local` override it — otherwise
// `DATABASE_URL=<production> npm run db:seed` silently seeds localhost when `.env.local` exists.
const preservedDatabaseUrl = process.env.DATABASE_URL;
const preservedDirectUrl = process.env.DIRECT_URL;
loadEnv({ path: resolve(root, ".env") });
if (existsSync(resolve(root, ".env.local"))) {
  loadEnv({ path: resolve(root, ".env.local"), override: true });
}
if (preservedDatabaseUrl !== undefined) {
  process.env.DATABASE_URL = preservedDatabaseUrl;
}
if (preservedDirectUrl !== undefined) {
  process.env.DIRECT_URL = preservedDirectUrl;
}

import { hashPassword } from "../src/lib/auth/password";
import { GLOBAL_QUESTION_BANK_SEED } from "./question-bank-seed-data";

async function main() {
  const { prisma } = await import("../src/lib/db");
  const { SCHOOL_PUBLIC_EXTRA_CARDS_KEY } = await import("../src/lib/school-public");
  const demoHero =
    "https://images.unsplash.com/photo-1580582932707-5207e1e8b0d4?auto=format&fit=crop&w=1600&q=80";

  const org = await prisma.organization.upsert({
    where: { slug: "demo-school" },
    create: { name: "Demo School", slug: "demo-school", heroImageUrl: demoHero, status: "ACTIVE" },
    update: { name: "Demo School", heroImageUrl: demoHero, status: "ACTIVE" },
  });

  const passwordHash = await hashPassword("password123");

  const users = [
    { email: "admin@test.com", name: "Demo Admin", role: "ADMIN" as const },
    { email: "teacher@test.com", name: "Demo Teacher", role: "TEACHER" as const },
    { email: "student@test.com", name: "Demo Student", role: "STUDENT" as const },
    { email: "ward2@test.com", name: "Demo Student (sibling)", role: "STUDENT" as const },
    { email: "parent@test.com", name: "Demo Parent", role: "PARENT" as const },
  ];

  await prisma.cmsEntry.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "dashboard.welcome" } },
    create: { organizationId: org.id, key: "dashboard.welcome", value: "Welcome back — keep up the great work." },
    update: { value: "Welcome back — keep up the great work." },
  });
  await prisma.cmsEntry.upsert({
    where: { organizationId_key: { organizationId: org.id, key: "dashboard.subtitle" } },
    create: {
      organizationId: org.id,
      key: "dashboard.subtitle",
      value: "Headlines here are editable by admins under CMS — no redeploy required.",
    },
    update: {
      value: "Headlines here are editable by admins under CMS — no redeploy required.",
    },
  });

  const schoolPublic: { key: string; value: string }[] = [
    {
      key: "school.public.hero.subtitle",
      value: "Excellence in learning — visit our public page for admissions, about us, and contact information.",
    },
    {
      key: "school.public.hero.ctaText",
      value: "Member sign in",
    },
    {
      key: "school.public.hero.ctaHref",
      value: "/login?org=demo-school",
    },
    {
      key: "school.public.admissions",
      value:
        "We welcome families who value curiosity and community.\n\nApplications are reviewed year-round. Schedule a tour through the contact section.",
    },
    {
      key: "school.public.about",
      value:
        "We are a community-focused school dedicated to academic growth and character.\n\nOur faculty bring years of experience; our students lead clubs, service projects, and performances throughout the year.\n\nProspective families can tour campus and meet teachers through the admissions process.",
    },
    {
      key: "school.public.about.videoUrl",
      value: "",
    },
    {
      key: "school.public.gallery",
      value:
        "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80\nhttps://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80",
    },
    {
      key: "school.public.contact",
      value:
        "Demo School\n123 Learning Lane\n\nPhone: (555) 010-0000\nEmail: hello@demo-school.local\n\nOffice hours: Mon–Fri 8am–4pm",
    },
  ];

  for (const sp of schoolPublic) {
    await prisma.cmsEntry.upsert({
      where: { organizationId_key: { organizationId: org.id, key: sp.key } },
      create: { organizationId: org.id, key: sp.key, value: sp.value },
      update: { value: sp.value },
    });
  }

  const demoExtraCards = JSON.stringify([
    {
      id: "seed-campus-tours",
      title: "Campus tours",
      body: "Prospective families can book a guided visit — see classrooms, arts spaces, and our library.\n\nUse the contact section to request a time.",
      imageUrl: "",
      videoUrl: "",
    },
    {
      id: "seed-after-school",
      title: "After school",
      body: "Clubs, study hall, and athletics run until 5pm on weekdays. Enrolled families receive the full activities guide.",
      imageUrl: "",
      videoUrl: "",
    },
  ]);
  await prisma.cmsEntry.upsert({
    where: { organizationId_key: { organizationId: org.id, key: SCHOOL_PUBLIC_EXTRA_CARDS_KEY } },
    create: { organizationId: org.id, key: SCHOOL_PUBLIC_EXTRA_CARDS_KEY, value: demoExtraCards },
    update: { value: demoExtraCards },
  });

  const globalBankCount = await prisma.questionBankItem.count({ where: { organizationId: null } });
  if (globalBankCount === 0) {
    await prisma.questionBankItem.createMany({ data: GLOBAL_QUESTION_BANK_SEED });
  }

  for (const u of users) {
    await prisma.user.upsert({
      where: {
        organizationId_email: { organizationId: org.id, email: u.email },
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        organizationId: org.id,
      },
      update: {
        name: u.name,
        role: u.role,
        passwordHash,
      },
    });
  }

  const author =
    (await prisma.user.findFirst({ where: { organizationId: org.id, role: "TEACHER" } })) ??
    (await prisma.user.findFirst({ where: { organizationId: org.id, role: "ADMIN" } }));

  if (author) {
    const demoTitle = "Welcome to Demo School";
    const existing = await prisma.course.findFirst({
      where: { organizationId: org.id, title: demoTitle },
    });
    if (!existing) {
      await prisma.course.create({
        data: {
          title: demoTitle,
          description: "Sample published course with one module and lesson.",
          published: true,
          organizationId: org.id,
          createdById: author.id,
          modules: {
            create: [
              {
                title: "Getting started",
                order: 0,
                lessons: {
                  create: [
                    {
                      title: "Your first lesson",
                      order: 0,
                      content:
                        "This is sample lesson content. Sign in as teacher or admin to edit the course structure.",
                    },
                  ],
                },
              },
            ],
          },
        },
      });
    }
  }

  if (author) {
    const slug = "welcome-to-demo-school";
    const hasPost = await prisma.blogPost.findUnique({
      where: { organizationId_slug: { organizationId: org.id, slug } },
    });
    if (!hasPost) {
      await prisma.blogPost.create({
        data: {
          organizationId: org.id,
          authorId: author.id,
          slug,
          title: "Welcome to your upgraded LMS",
          excerpt: "Blog posts, a resource library, course chat, and headless CMS copy are now available.",
          body: "This post is seeded for demo-school. Teachers and admins can create more from the Blog section.\n\nTry the Library for PDFs and videos, and open any course to use real-time discussion (SSE).",
          published: true,
        },
      });
    }
  }

  const studentUser = await prisma.user.findFirst({
    where: { organizationId: org.id, email: "student@test.com" },
  });
  const ward2User = await prisma.user.findFirst({
    where: { organizationId: org.id, email: "ward2@test.com" },
  });
  const parentUser = await prisma.user.findFirst({
    where: { organizationId: org.id, email: "parent@test.com" },
  });
  if (parentUser) {
    for (const child of [studentUser, ward2User]) {
      if (!child) continue;
      await prisma.parentStudentLink.upsert({
        where: {
          organizationId_parentUserId_studentUserId: {
            organizationId: org.id,
            parentUserId: parentUser.id,
            studentUserId: child.id,
          },
        },
        create: {
          organizationId: org.id,
          parentUserId: parentUser.id,
          studentUserId: child.id,
        },
        update: {},
      });
    }
  }

  const teacherUser = await prisma.user.findFirst({
    where: { organizationId: org.id, email: "teacher@test.com" },
  });

  const demoCourse = await prisma.course.findFirst({
    where: { organizationId: org.id, title: "Welcome to Demo School" },
  });
  if (demoCourse && studentUser) {
    await prisma.enrollment.upsert({
      where: {
        userId_courseId: { userId: studentUser.id, courseId: demoCourse.id },
      },
      create: {
        userId: studentUser.id,
        courseId: demoCourse.id,
        progressPercent: 0,
      },
      update: {},
    });
    let demoCohort = await prisma.schoolCohort.findFirst({
      where: { organizationId: org.id, name: "Demo Class 1" },
    });
    if (!demoCohort) {
      demoCohort = await prisma.schoolCohort.create({
        data: {
          organizationId: org.id,
          name: "Demo Class 1",
          gradeLabel: "Demo grade",
          academicYearLabel: org.academicYearLabel,
          homeroomTeacherId: teacherUser?.id ?? null,
        },
      });
    } else {
      await prisma.schoolCohort.update({
        where: { id: demoCohort.id },
        data: {
          gradeLabel: "Demo grade",
          academicYearLabel: org.academicYearLabel,
          ...(teacherUser ? { homeroomTeacherId: teacherUser.id } : {}),
        },
      });
    }
    if (teacherUser) {
      await prisma.cohortInstructor.upsert({
        where: { cohortId_userId: { cohortId: demoCohort.id, userId: teacherUser.id } },
        create: { cohortId: demoCohort.id, userId: teacherUser.id },
        update: {},
      });
    }
    await prisma.cohortMembership.upsert({
      where: { cohortId_userId: { cohortId: demoCohort.id, userId: studentUser.id } },
      create: { cohortId: demoCohort.id, userId: studentUser.id },
      update: {},
    });
    if (ward2User) {
      await prisma.cohortMembership.upsert({
        where: { cohortId_userId: { cohortId: demoCohort.id, userId: ward2User.id } },
        create: { cohortId: demoCohort.id, userId: ward2User.id },
        update: {},
      });
    }
    await prisma.courseCohort.upsert({
      where: { courseId_cohortId: { courseId: demoCourse.id, cohortId: demoCohort.id } },
      create: { courseId: demoCourse.id, cohortId: demoCohort.id },
      update: {},
    });
  }

  const adminUser = await prisma.user.findFirst({
    where: { organizationId: org.id, email: "admin@test.com" },
  });
  if (adminUser) {
    const wallCount = await prisma.organizationMessage.count({ where: { organizationId: org.id } });
    if (wallCount === 0) {
      await prisma.organizationMessage.create({
        data: {
          organizationId: org.id,
          senderKind: "MEMBER",
          userId: adminUser.id,
          body: "Welcome to the school-wide message board. Everyone in your school can read and post here. Platform operators can also message this school from the platform console.",
        },
      });
    }
  }

  let term = await prisma.academicTerm.findFirst({
    where: { organizationId: org.id, code: "demo-current" },
  });
  if (!term) {
    await prisma.academicTerm.updateMany({
      where: { organizationId: org.id },
      data: { isCurrent: false },
    });
    term = await prisma.academicTerm.create({
      data: {
        organizationId: org.id,
        code: "demo-current",
        label: "Current term (demo)",
        sortOrder: 0,
        isCurrent: true,
      },
    });
  }

  const seededCourse = await prisma.course.findFirst({
    where: { organizationId: org.id, title: "Welcome to Demo School" },
  });
  if (seededCourse && term) {
    await prisma.course.update({
      where: { id: seededCourse.id },
      data: { academicTermId: term.id, creditHours: 3 },
    });
  }

  // --- Higher-ed demo org: /login?org=demo-university · headmin|heteacher|hestudent@test.com / password123 ---
  const heOrg = await prisma.organization.upsert({
    where: { slug: "demo-university" },
    create: {
      name: "Demo University",
      slug: "demo-university",
      heroImageUrl: demoHero,
      status: "ACTIVE",
      educationLevel: "HIGHER_ED",
    },
    update: { educationLevel: "HIGHER_ED", name: "Demo University", status: "ACTIVE" },
  });

  const heUserSpecs = [
    { email: "headmin@test.com", name: "HE Admin", role: "ADMIN" as const },
    { email: "heteacher@test.com", name: "HE Faculty", role: "TEACHER" as const },
    { email: "hestudent@test.com", name: "HE Student", role: "STUDENT" as const },
  ];
  for (const u of heUserSpecs) {
    await prisma.user.upsert({
      where: { organizationId_email: { organizationId: heOrg.id, email: u.email } },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        organizationId: heOrg.id,
      },
      update: { name: u.name, role: u.role, passwordHash },
    });
  }

  const heTeacher = await prisma.user.findFirst({
    where: { organizationId: heOrg.id, email: "heteacher@test.com" },
  });
  const heStudent = await prisma.user.findFirst({
    where: { organizationId: heOrg.id, email: "hestudent@test.com" },
  });
  const heAuthor =
    heTeacher ??
    (await prisma.user.findFirst({ where: { organizationId: heOrg.id, role: "TEACHER" } })) ??
    (await prisma.user.findFirst({ where: { organizationId: heOrg.id, role: "ADMIN" } }));

  let heDiv = await prisma.facultyDivision.findFirst({
    where: { organizationId: heOrg.id, name: "Faculty of Science (demo)" },
  });
  if (!heDiv) {
    heDiv = await prisma.facultyDivision.create({
      data: { organizationId: heOrg.id, name: "Faculty of Science (demo)", code: "SCI", sortOrder: 0 },
    });
  }

  let heDept = await prisma.academicDepartment.findFirst({
    where: { organizationId: heOrg.id, code: "DEMO-CS" },
  });
  if (!heDept && heTeacher) {
    heDept = await prisma.academicDepartment.create({
      data: {
        organizationId: heOrg.id,
        name: "Computer Science (demo)",
        code: "DEMO-CS",
        facultyDivisionId: heDiv.id,
        chairUserId: heTeacher.id,
      },
    });
    await prisma.departmentInstructor.upsert({
      where: { departmentId_userId: { departmentId: heDept.id, userId: heTeacher.id } },
      create: { departmentId: heDept.id, userId: heTeacher.id },
      update: {},
    });
  }

  if (heDept && heStudent) {
    await prisma.studentDepartmentAffiliation.upsert({
      where: { departmentId_userId: { departmentId: heDept.id, userId: heStudent.id } },
      create: { departmentId: heDept.id, userId: heStudent.id, isPrimary: true },
      update: { isPrimary: true },
    });
  }

  const heCourseTitle = "Introduction to Higher Ed LMS (demo)";
  let heCourse = await prisma.course.findFirst({
    where: { organizationId: heOrg.id, title: heCourseTitle },
  });
  if (!heCourse && heAuthor) {
    heCourse = await prisma.course.create({
      data: {
        title: heCourseTitle,
        description: "Sample HE course linked to the demo department.",
        published: true,
        organizationId: heOrg.id,
        createdById: heAuthor.id,
        modules: {
          create: [
            {
              title: "Orientation",
              order: 0,
              lessons: {
                create: [
                  {
                    title: "Welcome",
                    order: 0,
                    content: "You are in a higher-education organization. Departments replace K–12 classes.",
                  },
                ],
              },
            },
          ],
        },
      },
    });
  }

  if (heCourse && heDept) {
    await prisma.courseDepartment.upsert({
      where: { courseId_departmentId: { courseId: heCourse.id, departmentId: heDept.id } },
      create: { courseId: heCourse.id, departmentId: heDept.id },
      update: {},
    });
  }
  if (heCourse && heStudent) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: heStudent.id, courseId: heCourse.id } },
      create: { userId: heStudent.id, courseId: heCourse.id, progressPercent: 0 },
      update: {},
    });
  }

  console.info(
    "Seed complete: demo-school · admin|teacher|student|ward2|parent@test.com / password123 · parent linked to student + ward2 + enrollment (primary student) + Demo Class 1",
  );
  console.info(
    "Higher-ed demo: demo-university · headmin|heteacher|hestudent@test.com / password123 · dept + course link + enrollment",
  );
}

main()
  .then(async () => {
    const { prisma } = await import("../src/lib/db");
    await prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
