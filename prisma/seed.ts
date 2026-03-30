import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const root = process.cwd();
loadEnv({ path: resolve(root, ".env") });
if (existsSync(resolve(root, ".env.local"))) {
  loadEnv({ path: resolve(root, ".env.local"), override: true });
}

import { hashPassword } from "../src/lib/auth/password";

async function main() {
  const { prisma } = await import("../src/lib/db");
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

  console.info("Seed complete: org slug demo-school, users admin|teacher|student@test.com / password123");
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
