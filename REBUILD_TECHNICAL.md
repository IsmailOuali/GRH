# Fair'Up OS — Technical Brief for Rebuild

## Stack

| Layer | Choice | Version |
|-------|--------|---------|
| Framework | Next.js App Router | 16.x (Turbopack) |
| Language | TypeScript | strict |
| Styling | Tailwind CSS | v4 |
| UI components | shadcn/ui | latest (uses `@base-ui/react`, NOT Radix) |
| Database | SQLite | via Prisma |
| ORM | Prisma | **5.x** — DO NOT use 6 or 7 |
| Auth | Auth.js (next-auth) | v5 beta (`next-auth@beta`) |
| Forms | React Hook Form + Zod | Zod **v4** |
| PDF | @react-pdf/renderer | v4 |
| Password | bcryptjs | — |
| Dates | date-fns | — |
| Icons | lucide-react | — |
| Toasts | sonner | — |

---

## Critical Gotchas — Read Every One

### 1. Prisma version must be 5.x

Prisma 7 (auto-installed by `npx prisma init` today) has breaking changes:
- Requires `prisma.config.ts` instead of `datasource` block
- `url` field in datasource is removed

**Install explicitly:**
```bash
npm install prisma@5 @prisma/client@5
```

Do not leave a `prisma.config.ts` file in the project — it causes TypeScript errors.

---

### 2. SQLite limitations with Prisma

SQLite does **not** support Prisma native enums. Every `enum` type must be declared as `String` in the schema:

```prisma
// WRONG — will fail with SQLite
role  Role  @default(EMPLOYEE)
enum Role { EMPLOYEE MANAGER ADMIN }

// CORRECT
role  String  @default("EMPLOYEE")
```

SQLite also does **not** support `createMany` with `skipDuplicates: true`. In seed files, use individual `create()` calls in a loop instead.

---

### 3. Auth.js v5 — JWT callbacks must store both `id` and `role`

The `session.user.id` is NOT automatically populated. You must manually carry it through the JWT:

```ts
// src/auth.ts
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,                    // ← required, prevents host verification overhead
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      async authorize(credentials) {
        // validate + bcrypt.compare
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ?? token.sub) as string;  // token.sub is fallback
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
```

**Type declarations** — create `src/types/next-auth.d.ts`:
```ts
import "next-auth";
declare module "next-auth" {
  interface User { role?: string; }
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null; role: string; };
  }
}
declare module "next-auth/jwt" {
  interface JWT { id?: string; role?: string; }
}
```

---

### 4. Next.js 16 — middleware is now called "proxy"

The `middleware.ts` file convention is deprecated. Use:
- Filename: `src/proxy.ts`
- Export: named `proxy` function (not default export)

```ts
// src/proxy.ts
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const authProxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login");
  if (!isLoggedIn && !isAuthPage) return NextResponse.redirect(new URL("/login", req.url));
  if (isLoggedIn && isAuthPage) return NextResponse.redirect(new URL("/dashboard", req.url));
});

export function proxy(req: NextRequest) {
  return authProxy(req as Parameters<typeof authProxy>[0]);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

---

### 5. shadcn/ui uses `@base-ui/react`, NOT Radix UI

The components look the same but the API differs:

- **No `asChild` prop** on any trigger component. Remove it.
- **Select `onValueChange`** receives `string | null`, not `string`. Always guard:
  ```tsx
  <Select onValueChange={(v) => { if (v) setValue(v); }}>
  ```
- **DropdownMenu** trigger: just a plain element, no `asChild`.

---

### 6. Zod v4 API change

`parsed.error.errors` does not exist in Zod v4. Use `.issues`:
```ts
// WRONG
parsed.error.errors[0]?.message

// CORRECT
parsed.error.issues[0]?.message
```

---

### 7. `@react-pdf/renderer` — buffer to NextResponse

`renderToBuffer()` returns a Node.js `Buffer`. `NextResponse` does not accept it directly:

```ts
// CORRECT
const buffer = await renderToBuffer(<MyTemplate />);
return new NextResponse(new Uint8Array(buffer), {
  headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=doc.pdf" },
});
```

---

### 8. Login form must use try/catch

`signIn()` from `next-auth/react` can throw (not just return error) if the server is slow. Without try/catch, the loading spinner never resets:

```ts
async function handleSubmit(e) {
  e.preventDefault();
  setLoading(true);
  try {
    const res = await signIn("credentials", { ...fields, redirect: false });
    if (res?.error) setError("Email ou mot de passe incorrect.");
    else router.push("/dashboard");
  } catch {
    setError("Erreur réseau. Veuillez réessayer.");
  } finally {
    setLoading(false);
  }
}
```

---

### 9. Turbopack workspace root warning

Add to `next.config.ts` to silence:
```ts
import path from "path";
const nextConfig = {
  turbopack: { root: path.resolve(__dirname) },
};
export default nextConfig;
```

---

### 10. Prisma singleton for dev hot-reload

```ts
// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

---

## Database Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String
  role      String   @default("EMPLOYEE")  // EMPLOYEE | MANAGER | ADMIN
  position  String?
  hireDate  DateTime @default(now())
  createdAt DateTime @default(now())

  managerId String?
  manager   User?   @relation("ManagerEmployees", fields: [managerId], references: [id])
  employees User[]  @relation("ManagerEmployees")

  leaveBalance   LeaveBalance?
  leaveRequests  LeaveRequest[]      @relation("EmployeeLeaves")
  reviewedLeaves LeaveRequest[]      @relation("ReviewerLeaves")
  payslips       Payslip[]
  tickets        Ticket[]
  publishedNews  News[]
  generatedDocs  GeneratedDocument[] @relation("GeneratedByDocs")
  subjectDocs    GeneratedDocument[] @relation("SubjectDocs")
}

model LeaveBalance {
  id         String   @id @default(cuid())
  userId     String   @unique
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cpDays     Float    @default(25)
  rttDays    Float    @default(10)
  expiryDate DateTime
  updatedAt  DateTime @updatedAt
}

model LeaveRequest {
  id           String    @id @default(cuid())
  userId       String
  user         User      @relation("EmployeeLeaves", fields: [userId], references: [id], onDelete: Cascade)
  type         String    // CP | RTT | MALADIE | SANS_SOLDE
  startDate    DateTime
  endDate      DateTime
  days         Float
  comment      String?
  status       String    @default("PENDING")  // PENDING | APPROVED | REJECTED
  reviewedById String?
  reviewedBy   User?     @relation("ReviewerLeaves", fields: [reviewedById], references: [id])
  reviewNote   String?
  reviewedAt   DateTime?
  createdAt    DateTime  @default(now())
}

model Payslip {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  month        String   // e.g. "Janvier 2025"
  transferDate DateTime
  grossAmount  Float
  deductions   Float
  netAmount    Float
  pdfPath      String?
  createdAt    DateTime @default(now())
}

model Ticket {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  category    String   // RH | PAIE | IT | AUTRE
  description String
  status      String   @default("OPEN")  // OPEN | IN_PROGRESS | RESOLVED
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model News {
  id            String   @id @default(cuid())
  content       String
  publishedById String
  publishedBy   User     @relation(fields: [publishedById], references: [id])
  createdAt     DateTime @default(now())
}

model GeneratedDocument {
  id            String   @id @default(cuid())
  type          String   // ATTESTATION_CONGE | ATTESTATION_TRAVAIL | BULLETIN_PAIE
  subjectUserId String
  subjectUser   User     @relation("SubjectDocs", fields: [subjectUserId], references: [id])
  generatedById String
  generatedBy   User     @relation("GeneratedByDocs", fields: [generatedById], references: [id])
  pdfPath       String
  metadata      String   @default("{}")
  createdAt     DateTime @default(now())
}
```

---

## Environment Variables

```env
# .env.local
DATABASE_URL="file:./prisma/dev.db"
AUTH_SECRET="any-random-32-char-string"
AUTH_URL="http://localhost:3000"
```

Also create `.env` (used by Prisma CLI):
```env
DATABASE_URL="file:./prisma/dev.db"
```

---

## package.json seed script

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

Run with: `npx prisma db seed`

---

## File / Folder Structure

```
src/
  auth.ts                         Auth.js config
  proxy.ts                        Route protection (renamed from middleware.ts)
  lib/
    prisma.ts                     Singleton Prisma client
    utils.ts                      cn() helper (from shadcn)
  types/
    index.ts                      Role/Status type aliases + label maps
    next-auth.d.ts                Session/JWT type extensions
  components/
    Sidebar.tsx                   Client component, uses usePathname
    Header.tsx                    Client component, uses usePathname
    EmptyState.tsx                Generic empty state with Lucide icon
    StatusBadge.tsx               Colored badge for all status values
    ui/                           shadcn components
  pdf/
    CongeTemplate.tsx             @react-pdf/renderer template
    TravailTemplate.tsx
    BulletinTemplate.tsx
  app/
    layout.tsx                    Root layout (font, Toaster)
    page.tsx                      Redirect to /dashboard
    login/
      page.tsx                    Login form (client component)
    (dashboard)/
      layout.tsx                  Auth check, renders Sidebar + Header
      dashboard/page.tsx
      dashboard/loading.tsx
      conges/page.tsx
      conges/loading.tsx
      conges/LeaveForm.tsx        Client form component
      conges/actions.ts           submitLeaveRequest() server action
      paie/page.tsx
      paie/loading.tsx
      tickets/page.tsx
      tickets/loading.tsx
      tickets/TicketForm.tsx
      tickets/actions.ts
      validations/page.tsx
      validations/loading.tsx
      validations/ValidationButtons.tsx
      validations/actions.ts
      documents/page.tsx
      documents/loading.tsx
      documents/DocumentsClient.tsx
      admin/page.tsx
      admin/loading.tsx
      admin/AdminForms.tsx        AdminTabs + UserManagementSection + QuotaForm + NewsForm
      admin/actions.ts            createEmployee, deleteEmployee, updateLeaveBalance, publishNews
    api/
      auth/[...nextauth]/route.ts  { GET, POST } from handlers
      documents/generate/route.ts  PDF generation endpoint
      payslips/[id]/download/route.ts  Secure PDF download
```

---

## Auth API Route

```ts
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

---

## Server Actions Pattern

All mutations use Server Actions (`"use server"`). Always:
1. Call `auth()` and check role
2. Validate with Zod (`parsed.error.issues[0]?.message`)
3. Run Prisma query
4. Call `revalidatePath()` for affected routes
5. Return `{ success: true }` or `{ error: "message" }`

---

## Performance Notes

- `trustHost: true` in Auth.js config is **mandatory** — without it, every middleware request does host verification and takes 1–4 extra seconds.
- Every route folder needs a `loading.tsx` — without it, pages appear frozen while server fetches data.
- All mutations are Server Actions, no custom API routes needed (except PDF generation and payslip download which need streaming responses).
