import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  // Find a course in demo-school
  const course = await prisma.course.findFirst({
    where: { organization: { slug: "demo-school" } }
  });

  if (!course) {
    console.error("No course found in demo-school. Please run npm run db:seed first.");
    process.exit(1);
  }

  // Create or upsert proctored assessment
  const assessment = await prisma.assessment.create({
    data: {
      courseId: course.id,
      title: "BIOLOGY 101 (Spring 2024)",
      kind: "EXAM",
      deliveryMode: "SECURE_ONLINE",
      published: true,
      createdById: course.createdById
    }
  });
  console.log("Created Assessment:", assessment.title, "ID:", assessment.id);

  // Find students in this organization
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", organizationId: course.organizationId }
  });
  console.log("Found students:", students.length);

  // Create proctoring events
  const eventTypes = [
    { type: "tab_switch_paused", desc: "Student switched tab/exited fullscreen", sev: "yellow" },
    { type: "face_not_detected", desc: "Webcam feed lost face visibility", sev: "yellow" },
    { type: "audio_spike_detected", desc: "High decibel background noise detected", sev: "yellow" },
    { type: "multiple_faces_detected", desc: "Secondary face detected in camera viewport", sev: "red" }
  ];

  for (const student of students) {
    for (let i = 0; i < 3; i++) {
      const evt = eventTypes[(i + student.name!.charCodeAt(0)) % eventTypes.length];
      await prisma.proctoringEvent.create({
        data: {
          organizationId: course.organizationId,
          userId: student.id,
          assessmentId: assessment.id,
          eventType: evt.type,
          payload: {
            description: evt.desc,
            severity: evt.sev
          },
          createdAt: new Date(Date.now() - i * 3600000)
        }
      });
    }
  }
  console.log("Seeded proctoring events successfully.");
  process.exit(0);
}

void main();
