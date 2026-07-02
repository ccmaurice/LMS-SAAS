import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const orgs = await prisma.organization.findMany();
  console.log("Orgs count:", orgs.length);
  orgs.forEach(o => console.log("Org:", o.name, "Slug:", o.slug, "ID:", o.id));

  const assessments = await prisma.assessment.findMany({
    include: {
      course: {
        include: {
          organization: true
        }
      }
    }
  });
  console.log("Assessments count:", assessments.length);
  assessments.forEach(a => {
    console.log("Assessment:", a.title, "ID:", a.id, "Delivery:", a.deliveryMode, "Org:", a.course.organization.slug, "Course ID:", a.courseId);
  });
  
  process.exit(0);
}

void main();
