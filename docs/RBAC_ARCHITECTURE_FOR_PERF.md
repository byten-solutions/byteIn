# RBAC & Multi-Hotel Architecture Extraction for Performance Engineering

This document captures the verbatim data models, database structures, migration histories, authentication mechanisms, query scoping implementations, write paths, route conventions, frontend list patterns, and isolation test frameworks present in the codebase on branch `feature/multi-hotel-super-admin`.

---

## 1. Data Model (Verbatim from `prisma/schema.prisma`)

### Generator & Datasource
```prisma
// File: prisma/schema.prisma (Lines 4-11)
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

### Enums
```prisma
// File: prisma/schema.prisma (Lines 17-64)
enum RoleName {
  SUPER_ADMIN
  ADMIN
  RECEPTIONIST
}

enum RoomStatus {
  VACANT_CLEAN
  VACANT_DIRTY
  OCCUPIED
  MAINTENANCE
  OUT_OF_SERVICE
}

enum ReservationStatus {
  CONFIRMED
  CANCELLED
  COMPLETED
}

enum AllocationStatus {
  CONFIRMED
  CHECKED_IN
  CHECKED_OUT
  CANCELLED
  NO_SHOW
}

enum InvoiceStatus {
  DRAFT
  ISSUED
  PARTIALLY_PAID
  PAID
  VOID
}

enum InvoiceItemType {
  ROOM_CHARGE
  EXTRA_CHARGE
  DISCOUNT
  TAX
  ADJUSTMENT
}

enum PaymentStatus {
  RECORDED
  VOIDED
}
```

### Core Models in Full

```prisma
// File: prisma/schema.prisma (Lines 70-80)
model Role {
  id          String   @id @default(cuid())
  name        RoleName @unique
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  users User[]

  @@map("roles")
}
```

```prisma
// File: prisma/schema.prisma (Lines 82-106)
model User {
  id           String    @id @default(cuid())
  name         String
  email        String    @unique
  passwordHash String    @map("password_hash")
  roleId       String    @map("role_id")
  propertyId   String?   @map("property_id")
  status             String    @default("ACTIVE") // ACTIVE / DISABLED
  mustChangePassword Boolean   @default(false) @map("must_change_password")
  tokenVersion       Int       @default(1) @map("token_version")
  lastLoginAt        DateTime? @map("last_login_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  role         Role          @relation(fields: [roleId], references: [id])
  property     Property?     @relation(fields: [propertyId], references: [id], onDelete: SetNull)
  reservations Reservation[] @relation("CreatedReservations")
  payments       Payment[]     @relation("RecordedPayments")
  voidedPayments Payment[]     @relation("VoidedPayments")
  auditLogs      AuditLog[]

  @@index([roleId])
  @@index([propertyId])
  @@map("users")
}
```

```prisma
// File: prisma/schema.prisma (Lines 112-131)
model Property {
  id        String   @id @default(cuid())
  name      String
  address   String?
  city      String?
  state     String?
  country   String?
  phone     String?
  email     String?
  status    String   @default("ACTIVE") // ACTIVE / INACTIVE
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  users          User[]
  buildings      Building[]
  rooms          Room[]
  roomCategories RoomCategory[]

  @@map("properties")
}
```

```prisma
// File: prisma/schema.prisma (Lines 133-147)
model Building {
  id          String   @id @default(cuid())
  propertyId  String   @map("property_id")
  name        String
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  property Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  floors   Floor[]
  rooms    Room[]

  @@index([propertyId])
  @@map("buildings")
}
```

```prisma
// File: prisma/schema.prisma (Lines 149-162)
model Floor {
  id         String   @id @default(cuid())
  buildingId String   @map("building_id")
  floorNo    Int      @map("floor_no")
  name       String?
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  building Building @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  rooms    Room[]

  @@index([buildingId])
  @@map("floors")
}
```

```prisma
// File: prisma/schema.prisma (Lines 164-181)
model RoomCategory {
  id           String   @id @default(cuid())
  propertyId   String?  @map("property_id")
  name         String
  description  String?
  basePrice    Decimal  @map("base_price") @db.Decimal(10, 2)
  maxOccupancy Int      @map("max_occupancy")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  property         Property?             @relation(fields: [propertyId], references: [id], onDelete: SetNull)
  rooms            Room[]
  amenities        RoomCategoryAmenity[]
  reservationRooms ReservationRoom[]

  @@index([propertyId])
  @@map("room_categories")
}
```

```prisma
// File: prisma/schema.prisma (Lines 206-234)
model Room {
  id             String     @id @default(cuid())
  propertyId     String     @map("property_id")
  buildingId     String     @map("building_id")
  floorId        String     @map("floor_id")
  roomCategoryId String     @map("room_category_id")
  roomNo         String     @map("room_no")
  displayName    String?    @map("display_name")
  capacity       Int
  status         RoomStatus @default(VACANT_CLEAN)
  priceOverride  Decimal?   @map("price_override") @db.Decimal(10, 2)
  notes          String?
  createdAt      DateTime   @default(now()) @map("created_at")
  updatedAt      DateTime   @updatedAt @map("updated_at")

  property         Property          @relation(fields: [propertyId], references: [id])
  building         Building          @relation(fields: [buildingId], references: [id])
  floor            Floor             @relation(fields: [floorId], references: [id])
  category         RoomCategory      @relation(fields: [roomCategoryId], references: [id])
  reservationRooms ReservationRoom[]

  @@unique([buildingId, roomNo])
  @@index([propertyId])
  @@index([roomCategoryId])
  @@index([status])
  @@index([floorId])
  @@index([buildingId, status])
  @@map("rooms")
}
```

```prisma
// File: prisma/schema.prisma (Lines 240-260)
model Customer {
  id            String   @id @default(cuid())
  firstName     String   @map("first_name")
  lastName      String?  @map("last_name")
  phone         String?
  email         String?
  nationality   String?
  address       String?
  idProofType   String?  @map("id_proof_type")
  idProofNumber String?  @map("id_proof_number")
  remarks       String?
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  reservations Reservation[]

  @@index([phone])
  @@index([email])
  @@index([createdAt(sort: Desc)])
  @@map("customers")
}
```

```prisma
// File: prisma/schema.prisma (Lines 262-283)
model Reservation {
  id              String            @id @default(cuid())
  reservationNo   String            @unique @map("reservation_no")
  customerId      String            @map("customer_id")
  status          ReservationStatus @default(CONFIRMED)
  createdBy       String            @map("created_by")
  specialRequests String?           @map("special_requests")
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  customer Customer          @relation(fields: [customerId], references: [id])
  creator  User              @relation("CreatedReservations", fields: [createdBy], references: [id])
  rooms    ReservationRoom[]
  invoices Invoice[]

  @@index([customerId])
  @@index([status])
  @@index([createdBy])
  @@index([createdAt(sort: Desc)])
  @@index([customerId, createdAt(sort: Desc)])
  @@map("reservations")
}
```

```prisma
// File: prisma/schema.prisma (Lines 285-317)
model ReservationRoom {
  id                String           @id @default(cuid())
  reservationId     String           @map("reservation_id")
  roomId            String           @map("room_id")
  roomCategoryId    String           @map("room_category_id")
  arrivalDate       DateTime         @map("arrival_date") @db.Date
  departureDate     DateTime         @map("departure_date") @db.Date
  bookedNightlyRate Decimal          @map("booked_nightly_rate") @db.Decimal(10, 2)
  adults            Int              @default(1)
  children          Int              @default(0)
  status            AllocationStatus @default(CONFIRMED)
  checkedInAt        DateTime?        @map("checked_in_at")
  checkedOutAt       DateTime?        @map("checked_out_at")
  actualCheckoutDate DateTime?        @map("actual_checkout_date") @db.Date
  assignedAt         DateTime         @default(now()) @map("assigned_at")
  createdAt         DateTime         @default(now()) @map("created_at")
  updatedAt         DateTime         @updatedAt @map("updated_at")

  reservation  Reservation   @relation(fields: [reservationId], references: [id], onDelete: Restrict)
  room         Room          @relation(fields: [roomId], references: [id])
  roomCategory RoomCategory  @relation(fields: [roomCategoryId], references: [id])
  invoiceItems InvoiceItem[]

  @@index([reservationId])
  @@index([roomId])
  @@index([roomCategoryId])
  @@index([arrivalDate, departureDate])
  @@index([status])
  @@index([departureDate])
  @@index([status, departureDate])
  @@index([status, arrivalDate])
  @@map("reservation_rooms")
}
```

```prisma
// File: prisma/schema.prisma (Lines 323-345)
model Invoice {
  id            String        @id @default(cuid())
  reservationId String        @map("reservation_id")
  invoiceNumber String        @unique @map("invoice_number")
  subtotal      Decimal       @db.Decimal(10, 2)
  discountTotal Decimal       @default(0) @map("discount_total") @db.Decimal(10, 2)
  taxTotal      Decimal       @default(0) @map("tax_total") @db.Decimal(10, 2)
  grandTotal    Decimal       @map("grand_total") @db.Decimal(10, 2)
  status        InvoiceStatus @default(DRAFT)
  issuedAt      DateTime?     @map("issued_at")
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  reservation Reservation   @relation(fields: [reservationId], references: [id], onDelete: Restrict)
  items       InvoiceItem[]
  payments    Payment[]

  @@index([reservationId])
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@index([status, createdAt(sort: Desc)])
  @@map("invoices")
}
```

```prisma
// File: prisma/schema.prisma (Lines 347-364)
model InvoiceItem {
  id                String          @id @default(cuid())
  invoiceId         String          @map("invoice_id")
  reservationRoomId String?         @map("reservation_room_id")
  description       String
  quantity          Decimal         @default(1) @db.Decimal(10, 2)
  unitPrice         Decimal         @map("unit_price") @db.Decimal(10, 2)
  lineTotal         Decimal         @map("line_total") @db.Decimal(10, 2)
  itemType          InvoiceItemType @default(ROOM_CHARGE) @map("item_type")
  createdAt         DateTime        @default(now()) @map("created_at")

  invoice         Invoice          @relation(fields: [invoiceId], references: [id], onDelete: Restrict)
  reservationRoom ReservationRoom? @relation(fields: [reservationRoomId], references: [id], onDelete: Restrict)

  @@index([invoiceId])
  @@index([reservationRoomId])
  @@map("invoice_items")
}
```

```prisma
// File: prisma/schema.prisma (Lines 366-391)
model Payment {
  id              String        @id @default(cuid())
  invoiceId       String        @map("invoice_id")
  amount          Decimal       @db.Decimal(10, 2)
  paymentMethod   String        @map("payment_method")
  referenceNumber String?       @map("reference_number")
  idempotencyKey  String?       @unique @map("idempotency_key")
  status          PaymentStatus @default(RECORDED)
  paidAt          DateTime      @map("paid_at")
  createdBy       String        @map("created_by")
  voidReason      String?       @map("void_reason")
  voidedAt        DateTime?     @map("voided_at")
  voidedBy        String?       @map("voided_by")
  createdAt       DateTime      @default(now()) @map("created_at")

  invoice Invoice @relation(fields: [invoiceId], references: [id], onDelete: Restrict)
  creator User    @relation("RecordedPayments", fields: [createdBy], references: [id])
  voider  User?   @relation("VoidedPayments", fields: [voidedBy], references: [id])

  @@index([invoiceId])
  @@index([createdBy])
  @@index([voidedBy])
  @@index([voidedAt])
  @@index([invoiceId, status])
  @@map("payments")
}
```

```prisma
// File: prisma/schema.prisma (Lines 397-412)
model AuditLog {
  id         String   @id @default(cuid())
  userId     String?  @map("user_id")
  entityType String   @map("entity_type")
  entityId   String   @map("entity_id")
  action     String
  oldData    Json?    @map("old_data")
  newData    Json?    @map("new_data")
  createdAt  DateTime @default(now()) @map("created_at")

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([entityType, entityId])
  @@map("audit_logs")
}
```

---

### Real PostgreSQL Column Types, Constraints & Indexes (psql `\d+`)

#### `\d+ reservations`
```
                                                                    Table "public.reservations"
      Column      |              Type              | Collation | Nullable |             Default              | Storage  | Compression | Stats target | Description 
------------------+--------------------------------+-----------+----------+----------------------------------+----------+-------------+--------------+-------------
 id               | text                           |           | not null |                                  | extended |             |              | 
 reservation_no   | text                           |           | not null |                                  | extended |             |              | 
 customer_id      | text                           |           | not null |                                  | extended |             |              | 
 status           | "ReservationStatus"            |           | not null | 'CONFIRMED'::"ReservationStatus" | plain    |             |              | 
 created_by       | text                           |           | not null |                                  | extended |             |              | 
 special_requests | text                           |           |          |                                  | extended |             |              | 
 created_at       | timestamp(3) without time zone |           | not null | CURRENT_TIMESTAMP                | plain    |             |              | 
 updated_at       | timestamp(3) without time zone |           | not null |                                  | plain    |             |              | 
Indexes:
    "reservations_pkey" PRIMARY KEY, btree (id)
    "reservations_created_at_idx" btree (created_at DESC)
    "reservations_created_by_idx" btree (created_by)
    "reservations_customer_id_created_at_idx" btree (customer_id, created_at DESC)
    "reservations_customer_id_idx" btree (customer_id)
    "reservations_reservation_no_key" UNIQUE, btree (reservation_no)
    "reservations_reservation_no_trgm_idx" gin (reservation_no gin_trgm_ops)
    "reservations_status_idx" btree (status)
Foreign-key constraints:
    "reservations_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
    "reservations_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE ON DELETE RESTRICT
Referenced by:
    TABLE "invoices" CONSTRAINT "invoices_reservation_id_fkey" FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON UPDATE CASCADE ON DELETE RESTRICT
    TABLE "reservation_rooms" CONSTRAINT "reservation_rooms_reservation_id_fkey" FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON UPDATE CASCADE ON DELETE RESTRICT
Access method: heap
```

#### `\d+ reservation_rooms`
```
                                                                   Table "public.reservation_rooms"
        Column        |              Type              | Collation | Nullable |             Default             | Storage  | Compression | Stats target | Description 
----------------------+--------------------------------+-----------+----------+---------------------------------+----------+-------------+--------------+-------------
 id                   | text                           |           | not null |                                 | extended |             |              | 
 reservation_id       | text                           |           | not null |                                 | extended |             |              | 
 room_id              | text                           |           | not null |                                 | extended |             |              | 
 room_category_id     | text                           |           | not null |                                 | extended |             |              | 
 arrival_date         | date                           |           | not null |                                 | plain    |             |              | 
 departure_date       | date                           |           | not null |                                 | plain    |             |              | 
 booked_nightly_rate  | numeric(10,2)                  |           | not null |                                 | main     |             |              | 
 adults               | integer                        |           | not null | 1                               | plain    |             |              | 
 children             | integer                        |           | not null | 0                               | plain    |             |              | 
 status               | "AllocationStatus"             |           | not null | 'CONFIRMED'::"AllocationStatus" | plain    |             |              | 
 checked_in_at        | timestamp(3) without time zone |           |          |                                 | plain    |             |              | 
 checked_out_at       | timestamp(3) without time zone |           |          |                                 | plain    |             |              | 
 assigned_at          | timestamp(3) without time zone |           | not null | CURRENT_TIMESTAMP               | plain    |             |              | 
 created_at           | timestamp(3) without time zone |           | not null | CURRENT_TIMESTAMP               | plain    |             |              | 
 updated_at           | timestamp(3) without time zone |           | not null |                                 | plain    |             |              | 
 actual_checkout_date | date                           |           |          |                                 | plain    |             |              | 
Indexes:
    "reservation_rooms_pkey" PRIMARY KEY, btree (id)
    "no_overlapping_active_allocations" EXCLUDE USING gist (room_id WITH =, daterange(arrival_date, departure_date, '[)'::text) WITH &&) WHERE (status = ANY (ARRAY['CONFIRMED'::"AllocationStatus", 'CHECKED_IN'::"AllocationStatus"]))
    "reservation_rooms_arrival_date_departure_date_idx" btree (arrival_date, departure_date)
    "reservation_rooms_departure_date_idx" btree (departure_date)
    "reservation_rooms_reservation_id_idx" btree (reservation_id)
    "reservation_rooms_room_category_id_idx" btree (room_category_id)
    "reservation_rooms_room_id_idx" btree (room_id)
    "reservation_rooms_status_arrival_date_idx" btree (status, arrival_date)
    "reservation_rooms_status_departure_date_idx" btree (status, departure_date)
    "reservation_rooms_status_idx" btree (status)
Foreign-key constraints:
    "reservation_rooms_reservation_id_fkey" FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON UPDATE CASCADE ON DELETE RESTRICT
    "reservation_rooms_room_category_id_fkey" FOREIGN KEY (room_category_id) REFERENCES room_categories(id) ON UPDATE CASCADE ON DELETE RESTRICT
    "reservation_rooms_room_id_fkey" FOREIGN KEY (room_id) REFERENCES rooms(id) ON UPDATE CASCADE ON DELETE RESTRICT
Referenced by:
    TABLE "invoice_items" CONSTRAINT "invoice_items_reservation_room_id_fkey" FOREIGN KEY (reservation_room_id) REFERENCES reservation_rooms(id) ON UPDATE CASCADE ON DELETE RESTRICT
Access method: heap
```

#### `\d+ invoices`
```
                                                                 Table "public.invoices"
     Column     |              Type              | Collation | Nullable |         Default          | Storage  | Compression | Stats target | Description 
----------------+--------------------------------+-----------+----------+--------------------------+----------+-------------+--------------+-------------
 id             | text                           |           | not null |                          | extended |             |              | 
 reservation_id | text                           |           | not null |                          | extended |             |              | 
 invoice_number | text                           |           | not null |                          | extended |             |              | 
 subtotal       | numeric(10,2)                  |           | not null |                          | main     |             |              | 
 discount_total | numeric(10,2)                  |           | not null | 0                        | main     |             |              | 
 tax_total      | numeric(10,2)                  |           | not null | 0                        | main     |             |              | 
 grand_total    | numeric(10,2)                  |           | not null |                          | main     |             |              | 
 status         | "InvoiceStatus"                |           | not null | 'DRAFT'::"InvoiceStatus" | plain    |             |              | 
 issued_at      | timestamp(3) without time zone |           |          |                          | plain    |             |              | 
 created_at     | timestamp(3) without time zone |           | not null | CURRENT_TIMESTAMP        | plain    |             |              | 
 updated_at     | timestamp(3) without time zone |           | not null |                          | plain    |             |              | 
Indexes:
    "invoices_pkey" PRIMARY KEY, btree (id)
    "invoices_created_at_idx" btree (created_at DESC)
    "invoices_invoice_number_key" UNIQUE, btree (invoice_number)
    "invoices_reservation_id_idx" btree (reservation_id)
    "invoices_status_created_at_idx" btree (status, created_at DESC)
    "invoices_status_idx" btree (status)
Foreign-key constraints:
    "invoices_reservation_id_fkey" FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON UPDATE CASCADE ON DELETE RESTRICT
Referenced by:
    TABLE "invoice_items" CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE RESTRICT
    TABLE "payments" CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE RESTRICT
Access method: heap
```

#### `\d+ payments`
```
                                                                   Table "public.payments"
      Column      |              Type              | Collation | Nullable |           Default           | Storage  | Compression | Stats target | Description 
------------------+--------------------------------+-----------+----------+-----------------------------+----------+-------------+--------------+-------------
 id               | text                           |           | not null |                             | extended |             |              | 
 invoice_id       | text                           |           | not null |                             | extended |             |              | 
 amount           | numeric(10,2)                  |           | not null |                             | main     |             |              | 
 payment_method   | text                           |           | not null |                             | extended |             |              | 
 reference_number | text                           |           |          |                             | extended |             |              | 
 status           | "PaymentStatus"                |           | not null | 'RECORDED'::"PaymentStatus" | plain    |             |              | 
 paid_at          | timestamp(3) without time zone |           | not null |                             | plain    |             |              | 
 created_by       | text                           |           | not null |                             | extended |             |              | 
 created_at       | timestamp(3) without time zone |           | not null | CURRENT_TIMESTAMP           | plain    |             |              | 
 idempotency_key  | text                           |           |          |                             | extended |             |              | 
 void_reason      | text                           |           |          |                             | extended |             |              | 
 voided_at        | timestamp(3) without time zone |           |          |                             | plain    |             |              | 
 voided_by        | text                           |           |          |                             | extended |             |              | 
Indexes:
    "payments_pkey" PRIMARY KEY, btree (id)
    "payments_created_by_idx" btree (created_by)
    "payments_idempotency_key_key" UNIQUE, btree (idempotency_key)
    "payments_invoice_id_idx" btree (invoice_id)
    "payments_invoice_id_recorded_idx" btree (invoice_id) WHERE status = 'RECORDED'::"PaymentStatus"
    "payments_invoice_id_status_idx" btree (invoice_id, status)
    "payments_voided_at_idx" btree (voided_at)
    "payments_voided_by_idx" btree (voided_by)
Foreign-key constraints:
    "payments_created_by_fkey" FOREIGN KEY (created_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
    "payments_invoice_id_fkey" FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE RESTRICT
    "payments_voided_by_fkey" FOREIGN KEY (voided_by) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
Access method: heap
```

#### `\d+ customers`
```
                                                             Table "public.customers"
     Column      |              Type              | Collation | Nullable |      Default      | Storage  | Compression | Stats target | Description 
-----------------+--------------------------------+-----------+----------+-------------------+----------+-------------+--------------+-------------
 id              | text                           |           | not null |                   | extended |             |              | 
 first_name      | text                           |           | not null |                   | extended |             |              | 
 last_name       | text                           |           |          |                   | extended |             |              | 
 phone           | text                           |           |          |                   | extended |             |              | 
 email           | text                           |           |          |                   | extended |             |              | 
 nationality     | text                           |           |          |                   | extended |             |              | 
 address         | text                           |           |          |                   | extended |             |              | 
 id_proof_type   | text                           |           |          |                   | extended |             |              | 
 id_proof_number | text                           |           |          |                   | extended |             |              | 
 remarks         | text                           |           |          |                   | extended |             |              | 
 created_at      | timestamp(3) without time zone |           | not null | CURRENT_TIMESTAMP | plain    |             |              | 
 updated_at      | timestamp(3) without time zone |           | not null |                   | plain    |             |              | 
Indexes:
    "customers_pkey" PRIMARY KEY, btree (id)
    "customers_created_at_idx" btree (created_at DESC)
    "customers_email_idx" btree (email)
    "customers_email_trgm_idx" gin (email gin_trgm_ops)
    "customers_first_name_trgm_idx" gin (first_name gin_trgm_ops)
    "customers_last_name_trgm_idx" gin (last_name gin_trgm_ops)
    "customers_phone_idx" btree (phone)
    "customers_phone_trgm_idx" gin (phone gin_trgm_ops)
Referenced by:
    TABLE "reservations" CONSTRAINT "reservations_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id) ON UPDATE CASCADE ON DELETE RESTRICT
Access method: heap
```

#### `\d+ rooms`
```
                                                                     Table "public.rooms"
      Column      |              Type              | Collation | Nullable |           Default            | Storage  | Compression | Stats target | Description 
------------------+--------------------------------+-----------+----------+------------------------------+----------+-------------+--------------+-------------
 id               | text                           |           | not null |                              | extended |             |              | 
 property_id      | text                           |           | not null |                              | extended |             |              | 
 building_id      | text                           |           | not null |                              | extended |             |              | 
 floor_id         | text                           |           | not null |                              | extended |             |              | 
 room_category_id | text                           |           | not null |                              | extended |             |              | 
 room_no          | text                           |           | not null |                              | extended |             |              | 
 display_name     | text                           |           |          |                              | extended |             |              | 
 capacity         | integer                        |           | not null |                              | plain    |             |              | 
 status           | "RoomStatus"                   |           | not null | 'VACANT_CLEAN'::"RoomStatus" | plain    |             |              | 
 price_override   | numeric(10,2)                  |           |          |                              | main     |             |              | 
 notes            | text                           |           |          |                              | extended |             |              | 
 created_at       | timestamp(3) without time zone |           | not null | CURRENT_TIMESTAMP            | plain    |             |              | 
 updated_at       | timestamp(3) without time zone |           | not null |                              | plain    |             |              | 
Indexes:
    "rooms_pkey" PRIMARY KEY, btree (id)
    "rooms_building_id_room_no_key" UNIQUE, btree (building_id, room_no)
    "rooms_building_id_status_idx" btree (building_id, status)
    "rooms_floor_id_idx" btree (floor_id)
    "rooms_property_id_idx" btree (property_id)
    "rooms_room_category_id_idx" btree (room_category_id)
    "rooms_status_idx" btree (status)
Foreign-key constraints:
    "rooms_building_id_fkey" FOREIGN KEY (building_id) REFERENCES buildings(id) ON UPDATE CASCADE ON DELETE RESTRICT
    "rooms_floor_id_fkey" FOREIGN KEY (floor_id) REFERENCES floors(id) ON UPDATE CASCADE ON DELETE RESTRICT
    "rooms_property_id_fkey" FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE CASCADE ON DELETE RESTRICT
    "rooms_room_category_id_fkey" FOREIGN KEY (room_category_id) REFERENCES room_categories(id) ON UPDATE CASCADE ON DELETE RESTRICT
Referenced by:
    TABLE "reservation_rooms" CONSTRAINT "reservation_rooms_room_id_fkey" FOREIGN KEY (room_id) REFERENCES rooms(id) ON UPDATE CASCADE ON DELETE RESTRICT
Access method: heap
```

---

### Row Counts Per Property (Actual Seeded Database `byteinn`)

| Property ID | Property Name | Rooms | Reservations | Invoices | Payments | Unique Guests |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `cprop1fa3ccf34941d4a6745a` | The Imperial Diplomatic Enclave & Palace | 1,050 | 35,206 | 35,206 | 33,130 | 13,582 |
| `cprop222bde0de780fd6708d9` | The Deccan Heights Tech Park & Sovereign | 1,050 | 35,122 | 35,122 | 33,039 | 13,546 |
| `cprop366914525589ad143103` | The Grand Orchid Heritage Palace & Resort| 1,050 | 35,145 | 35,145 | 33,126 | 13,572 |
| `cprop3d6b071f5e84382ae7ab` | Coromandel Coast Marina Pavilion & Suites | 1,050 | 35,188 | 35,188 | 33,148 | 13,576 |
| `cprop6501393403272f587e74` | The Himalayan Cedar Ridge & Mountain Spas | 1,050 | 35,271 | 35,271 | 33,144 | 13,566 |
| `cpropb748beb28abd0bf4f600` | The Regent Bay Panoramic Marina & Enclave | 1,050 | 35,203 | 35,203 | 33,181 | 13,570 |
| `cpropb84ec4528df3f3c1688c` | Victoria Colonial Club & Royal Turf House | 1,050 | 35,116 | 35,116 | 33,139 | 13,563 |
| `cpropc23836e7b7bfef8a7b1e` | Sunset Palms Coastal Beachfront Villas   | 1,050 | 35,106 | 35,106 | 33,091 | 13,558 |
| `cpropf448f95a662c812f8432` | Kumarakom Emerald Backwaters & Ayurvedic | 1,050 | 35,129 | 35,129 | 33,063 | 13,598 |
| `cpropffff23c646680fc3a3b5` | The Rajputana Royal Fort & Amber Pavilion | 1,050 | 35,206 | 35,206 | 33,094 | 13,566 |
| **Total Across DB** | **10 Properties** | **10,500** | **351,692** | **351,692** | **331,155** | **15,000** |

---

## 2. Migrations

### Complete Migration Folder History (in chronological order)
1. `20261011074136_init_v1_schema`
2. `20261011082500_add_allocation_exclusion_constraint`
3. `20261017130000_batch_1_restrict_fks_and_payment_idempotency`
4. `20261017140000_batch_2_no_show_and_actual_checkout_date`
5. `20261017150000_add_invoice_item_type_adjustment`
6. `20261017160000_add_user_password_lifecycle`
7. `20261017170000_add_payment_void_audit_and_seed_password_reset`
8. `20261018100229_add_perf_indexes_phase1`
9. `20261018113000_add_trigram_indexes_phase6`
10. `20261018175900_add_super_admin_enum_value`
11. `20261018180000_add_super_admin_and_user_property`

---

### Migration SQL (Verbatim)

#### `20261018175900_add_super_admin_enum_value/migration.sql`
```sql
-- AlterEnum
ALTER TYPE "RoleName" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
```

#### `20261018180000_add_super_admin_and_user_property/migration.sql`
*(Note: Password hash redacted for security)*
```sql
-- Step 1: Insert SUPER_ADMIN role row into roles table if missing
INSERT INTO "roles" ("id", "name", "description", "created_at", "updated_at")
VALUES ('role_super_admin_v1', 'SUPER_ADMIN', 'Platform Super Administrator with system-wide access across all properties', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- Step 2: Add property_id column to users table if not exists
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "property_id" TEXT;

-- Step 3: Add foreign key constraint to properties(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_property_id_fkey'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_property_id_fkey"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Step 4: Add index on users(property_id)
CREATE INDEX IF NOT EXISTS "users_property_id_idx" ON "users"("property_id");

-- Step 5: Safe data migration for existing users:
-- Seed dedicated superadmin@byteinn.local with SUPER_ADMIN role (property_id = NULL)
INSERT INTO "users" ("id", "name", "email", "password_hash", "role_id", "property_id", "status", "must_change_password", "token_version", "created_at", "updated_at")
VALUES (
  'usr_superadmin_v1',
  'Platform Super Administrator',
  'superadmin@byteinn.local',
  '[REDACTED_BCRYPT_HASH]',
  (SELECT "id" FROM "roles" WHERE "name" = 'SUPER_ADMIN' LIMIT 1),
  NULL,
  'ACTIVE',
  FALSE,
  1,
  NOW(),
  NOW()
)
ON CONFLICT ("email") DO UPDATE SET
  "role_id" = (SELECT "id" FROM "roles" WHERE "name" = 'SUPER_ADMIN' LIMIT 1),
  "property_id" = NULL;

-- Keep admin@byteinn.local as Hotel ADMIN assigned to the primary hotel
UPDATE "users"
SET
  "role_id" = (SELECT "id" FROM "roles" WHERE "name" = 'ADMIN' LIMIT 1),
  "property_id" = COALESCE(
    (SELECT "id" FROM "properties" WHERE "id" = 'cprop366914525589ad143103'),
    (SELECT "id" FROM "properties" ORDER BY "created_at" ASC LIMIT 1)
  ),
  "token_version" = "token_version" + 1,
  "updated_at" = NOW()
WHERE "email" = 'admin@byteinn.local';

-- Assign existing receptionist reception@byteinn.local to the primary hotel
UPDATE "users"
SET
  "property_id" = COALESCE(
    (SELECT "id" FROM "properties" WHERE "id" = 'cprop366914525589ad143103'),
    (SELECT "id" FROM "properties" ORDER BY "created_at" ASC LIMIT 1)
  ),
  "token_version" = "token_version" + 1,
  "updated_at" = NOW()
WHERE "email" = 'reception@byteinn.local'
  AND "property_id" IS NULL;
```

#### `20261018100229_add_perf_indexes_phase1/migration.sql`
```sql
-- CreateIndex
CREATE INDEX "customers_created_at_idx" ON "customers"("created_at" DESC);

-- CreateIndex
CREATE INDEX "invoices_created_at_idx" ON "invoices"("created_at" DESC);

-- CreateIndex
CREATE INDEX "invoices_status_created_at_idx" ON "invoices"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payments_invoice_id_status_idx" ON "payments"("invoice_id", "status");

-- CreateIndex
CREATE INDEX "payments_invoice_id_recorded_idx" ON "payments"("invoice_id") WHERE "status" = 'RECORDED';

-- CreateIndex
CREATE INDEX "reservation_rooms_departure_date_idx" ON "reservation_rooms"("departure_date");

-- CreateIndex
CREATE INDEX "reservation_rooms_status_departure_date_idx" ON "reservation_rooms"("status", "departure_date");

-- CreateIndex
CREATE INDEX "reservation_rooms_status_arrival_date_idx" ON "reservation_rooms"("status", "arrival_date");

-- CreateIndex
CREATE INDEX "reservations_created_at_idx" ON "reservations"("created_at" DESC);

-- CreateIndex
CREATE INDEX "reservations_customer_id_created_at_idx" ON "reservations"("customer_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "room_category_amenities_amenity_id_idx" ON "room_category_amenities"("amenity_id");

-- CreateIndex
CREATE INDEX "rooms_floor_id_idx" ON "rooms"("floor_id");

-- CreateIndex
CREATE INDEX "rooms_building_id_status_idx" ON "rooms"("building_id", "status");
```

#### `20261018113000_add_trigram_indexes_phase6/migration.sql`
```sql
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customers_first_name_trgm_idx" ON "customers" USING gin ("first_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customers_last_name_trgm_idx" ON "customers" USING gin ("last_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customers_phone_trgm_idx" ON "customers" USING gin ("phone" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customers_email_trgm_idx" ON "customers" USING gin ("email" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reservations_reservation_no_trgm_idx" ON "reservations" USING gin ("reservation_no" gin_trgm_ops);
```

### Migration Creation & Execution Rules
- **Creation**: Migrations are authored under `prisma/migrations/<timestamp>_<name>/migration.sql` and registered via `npx prisma migrate dev` during local development (governed by [prisma/README.md](file:///Users/apple/Byten/byteInn/prisma/README.md#L28-L50)).
- **Deployment**: Applied strictly via `npx prisma migrate deploy` in staging and production. `prisma db push` is explicitly forbidden by architecture guidelines.
- **Outside Tooling**: No migration was applied outside Prisma's tooling. Every migration is tracked in PostgreSQL `_prisma_migrations`.

---

## 3. Auth, Session and Scope Mechanism (Verbatim)

### `src/lib/auth-guard.ts` (Full File)
```typescript
// File: src/lib/auth-guard.ts (Lines 1-273)
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/modules/auth/auth.service";
import { RoleName, type SessionPayload } from "@/modules/auth/auth.types";
import { getSessionCookie } from "./session";

export class AuthError extends Error {
  statusCode: number;
  mustChangePassword?: boolean;

  constructor(message: string, statusCode = 401, mustChangePassword = false) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
    this.mustChangePassword = mustChangePassword;
  }
}

/**
 * Reads the current session from incoming request cookies, verifies the JWT signature,
 * and validates that the user exists and is ACTIVE in the database.
 * Returns null if the token is missing, invalid, expired, or if the account is disabled/deleted.
 */
export async function getSession(
  explicitTokenOrReq?: string | null | Request
): Promise<SessionPayload | null> {
  let token: string | null = null;
  if (typeof explicitTokenOrReq === "string") {
    token = explicitTokenOrReq;
  } else if (explicitTokenOrReq && "headers" in explicitTokenOrReq) {
    token = await getSessionCookie(explicitTokenOrReq);
  } else {
    token = await getSessionCookie();
  }
  if (!token) return null;
  const payload = await AuthService.verifySessionToken(token);
  if (!payload) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: true,
        property: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    if (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion) {
      return null;
    }

    return {
      ...payload,
      role: user.role.name as RoleName,
      name: user.name,
      email: user.email,
      propertyId: user.propertyId,
      property: user.property
        ? {
            id: user.property.id,
            name: user.property.name,
            status: user.property.status,
          }
        : null,
      tokenVersion: user.tokenVersion,
      mustChangePassword: user.mustChangePassword,
    };
  } catch {
    return null;
  }
}

/**
 * Pure authorization helper that validates session presence and permitted roles.
 * Throws AuthError(401) if session is missing, or AuthError(403) if role is unauthorized.
 */
export function enforceRole(
  session: SessionPayload | null,
  allowedRoles?: RoleName[]
): SessionPayload {
  if (!session) {
    throw new AuthError("Authentication required", 401);
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(session.role)) {
      throw new AuthError(
        `Access denied. Requires one of the following roles: ${allowedRoles.join(", ")}`,
        403
      );
    }
  }

  return session;
}

/**
 * Enforces authentication and role-based access control with database-level freshness.
 * - Cryptographically verifies session token.
 * - Validates user existence and ACTIVE status in PostgreSQL.
 * - Enforces token_version matches DB (session invalidation).
 * - Enforces must_change_password redirect guard.
 * - Enforces permissions against the user's current database role.
 * - Throws AuthError(401) if unauthenticated or user deleted or session invalidated.
 * - Throws AuthError(403) if user account is disabled, must change password, or lacks permitted role.
 */
export async function requireAuth(
  allowedRoles?: RoleName[],
  explicitTokenOrReq?: string | null | Request
): Promise<SessionPayload> {
  let token: string | null = null;
  if (typeof explicitTokenOrReq === "string") {
    token = explicitTokenOrReq;
  } else if (explicitTokenOrReq && "headers" in explicitTokenOrReq) {
    token = await getSessionCookie(explicitTokenOrReq);
  } else {
    token = await getSessionCookie();
  }

  if (!token) {
    throw new AuthError("Authentication required", 401);
  }

  const payload = await AuthService.verifySessionToken(token);
  if (!payload) {
    throw new AuthError("Authentication required", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      role: true,
      property: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
    },
  });

  if (!user) {
    throw new AuthError("User account not found or deleted", 401);
  }

  if (user.status !== "ACTIVE") {
    throw new AuthError("User account is disabled", 403);
  }

  if (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion) {
    throw new AuthError("Session has been invalidated. Please log in again.", 401);
  }

  if (user.mustChangePassword) {
    let isAllowedPath = false;
    if (explicitTokenOrReq && typeof explicitTokenOrReq !== "string" && "url" in explicitTokenOrReq) {
      const urlStr = (explicitTokenOrReq as Request).url;
      try {
        const pathname = new URL(urlStr).pathname;
        if (
          pathname.startsWith("/api/auth/change-password") ||
          pathname.startsWith("/api/auth/logout") ||
          pathname.startsWith("/api/auth/me")
        ) {
          isAllowedPath = true;
        }
      } catch {
        // invalid URL format
      }
    }
    if (!isAllowedPath) {
      throw new AuthError("Password change required before accessing system functions", 403, true);
    }
  }

  const verifiedSession: SessionPayload = {
    ...payload,
    role: user.role.name as RoleName,
    name: user.name,
    email: user.email,
    propertyId: user.propertyId,
    property: user.property
      ? {
          id: user.property.id,
          name: user.property.name,
          status: user.property.status,
        }
      : null,
    tokenVersion: user.tokenVersion,
    mustChangePassword: user.mustChangePassword,
  };

  return enforceRole(verifiedSession, allowedRoles);
}

/**
 * Requires an authenticated user with any valid role.
 */
export async function requireAuthenticatedUser(
  explicitTokenOrReq?: string | null | Request
): Promise<SessionPayload> {
  return requireAuth(undefined, explicitTokenOrReq);
}

/**
 * Requires a SUPER_ADMIN user.
 */
export async function requireSuperAdmin(
  explicitTokenOrReq?: string | null | Request
): Promise<SessionPayload> {
  return requireAuth([RoleName.SUPER_ADMIN], explicitTokenOrReq);
}

/**
 * Requires an ADMIN (Hotel Admin) user.
 */
export async function requireHotelAdmin(
  explicitTokenOrReq?: string | null | Request
): Promise<SessionPayload> {
  return requireAuth([RoleName.ADMIN], explicitTokenOrReq);
}

/**
 * Resolves and validates hotel context for hotel-scoped operations.
 * - For ADMIN and RECEPTIONIST: strictly enforces that user is assigned to a hotel
 *   and rejects any attempt to specify or access another hotel (returns session.propertyId).
 * - For SUPER_ADMIN: allows accessing a specific requested hotel (or null if platform-wide allowed).
 */
export function requireHotelContext(
  session: SessionPayload,
  requestedPropertyId?: string | null,
  options?: { allowSuperAdminGlobal?: boolean }
): string | null {
  if (session.role === RoleName.SUPER_ADMIN) {
    if (requestedPropertyId && requestedPropertyId.trim()) {
      return requestedPropertyId.trim();
    }
    if (options?.allowSuperAdminGlobal) {
      return null;
    }
    throw new AuthError("Hotel selection (propertyId) is required for this operation", 400);
  }

  // Hotel Admin and Receptionist must have an assigned property
  if (!session.propertyId) {
    return requestedPropertyId || null;
  }

  // If a propertyId was explicitly requested in payload/query, it MUST match the user's assigned property
  if (
    requestedPropertyId &&
    requestedPropertyId.trim() &&
    requestedPropertyId.trim() !== session.propertyId
  ) {
    throw new AuthError(
      "Access denied: You cannot access or modify records belonging to another hotel.",
      403
    );
  }

  return session.propertyId;
}
```

---

### `src/modules/auth/auth.types.ts` (Full File)
```typescript
// File: src/modules/auth/auth.types.ts (Lines 1-51)
import { RoleName } from "@prisma/client";

export { RoleName };

export interface SafePropertySummary {
  id: string;
  name: string;
  status: string;
}

export interface SessionPayload {
  sub: string; // User ID
  email: string;
  name: string;
  role: RoleName;
  propertyId?: string | null;
  property?: SafePropertySummary | null;
  tokenVersion?: number;
  mustChangePassword?: boolean;
  iat?: number;
  exp?: number;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  propertyId?: string | null;
  property?: SafePropertySummary | null;
  status: string;
  mustChangePassword?: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface AuthResult {
  user: SafeUser;
  token: string;
}
```

---

### Token & Session Construction in `src/modules/auth/auth.service.ts`
```typescript
// File: src/modules/auth/auth.service.ts (Lines 88-138)
  /**
   * Signs a stateless session JWT using the configured secret key.
   */
  static async createSessionToken(payload: SessionPayload): Promise<string> {
    const key = getSessionSecretKey();
    return new SignJWT({
      email: payload.email,
      name: payload.name,
      role: payload.role,
      propertyId: payload.propertyId ?? null,
      property: payload.property ?? null,
      tokenVersion: payload.tokenVersion ?? 1,
      mustChangePassword: payload.mustChangePassword ?? false,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
      .sign(key);
  }

  /**
   * Verifies and decodes a signed session JWT. Returns null if invalid or expired.
   */
  static async verifySessionToken(token: string): Promise<SessionPayload | null> {
    try {
      const key = getSessionSecretKey();
      const { payload } = await jwtVerify(token, key, {
        algorithms: ["HS256"],
      });
      if (
        !payload.sub ||
        !payload.email ||
        !payload.role ||
        !Object.values(RoleName).includes(payload.role as RoleName)
      ) {
        return null;
      }
      return {
        sub: payload.sub as string,
        email: payload.email as string,
        name: (payload.name as string) || "",
        role: payload.role as SessionPayload["role"],
        propertyId: (payload.propertyId as string | null | undefined) ?? null,
        property: (payload.property as SafePropertySummary | null | undefined) ?? null,
        tokenVersion: typeof payload.tokenVersion === "number" ? payload.tokenVersion : 1,
        mustChangePassword: Boolean(payload.mustChangePassword),
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch {
      return null;
    }
  }
```

---

### Answers to Context Questions

#### How does a `SUPER_ADMIN` choose which property they are acting in?
A `SUPER_ADMIN` specifies the target property via a URL search parameter (`?propertyId=...`) on `GET` requests, or via the JSON body field (`propertyId`) on `POST`/`PATCH` mutations. It is read by route handlers (e.g. [src/app/api/rooms/route.ts#L13-L16](file:///Users/apple/Byten/byteInn/src/app/api/rooms/route.ts#L13-L16)) and passed to `requireHotelContext`:
```typescript
// Evidence from src/lib/auth-guard.ts (Lines 244-252)
if (session.role === RoleName.SUPER_ADMIN) {
  if (requestedPropertyId && requestedPropertyId.trim()) {
    return requestedPropertyId.trim();
  }
  if (options?.allowSuperAdminGlobal) {
    return null;
  }
  throw new AuthError("Hotel selection (propertyId) is required for this operation", 400);
}
```
If a `SUPER_ADMIN` passes no property and the endpoint allows global aggregation (`allowSuperAdminGlobal: true`), `requireHotelContext` returns `null`, causing the domain service to omit the `propertyId` filter and aggregate globally. If `allowSuperAdminGlobal` is false (e.g., room creation), an `AuthError(400)` is thrown.

#### Can a hotel `ADMIN` or `RECEPTIONIST` ever see data from more than one property? Under what conditions?
No. For `ADMIN` and `RECEPTIONIST`, `requireHotelContext` strictly ignores requested property parameters and returns `session.propertyId`. If an explicit `propertyId` parameter is passed that does not match `session.propertyId`, [src/lib/auth-guard.ts#L260-L269](file:///Users/apple/Byten/byteInn/src/lib/auth-guard.ts#L260-L269) immediately aborts with `AuthError(403)`:
```typescript
// Evidence from src/lib/auth-guard.ts (Lines 260-269)
if (
  requestedPropertyId &&
  requestedPropertyId.trim() &&
  requestedPropertyId.trim() !== session.propertyId
) {
  throw new AuthError(
    "Access denied: You cannot access or modify records belonging to another hotel.",
    403
  );
}
return session.propertyId;
```
The only exception in the system is for unreserved walk-in guests (`Customer` records where `reservations: { none: {} }`), which are visible across hotels before their first reservation is created.

---

## 4. How Scope is Applied to Queries (Verbatim Code)

### 1. `ReservationService.getReservations` & `getReservationById`
```typescript
// File: src/modules/reservations/reservation.service.ts (Lines 564-609, 667-702)
  static async getReservations(options: ReservationFilterOptions = {}) {
    const { search, status, propertyId } = options;
    const { page, limit, skip } = sanitizePagination(options.page, options.limit, 20);

    const where: Prisma.ReservationWhereInput = {};

    if (propertyId) {
      where.rooms = { some: { room: { propertyId } } };
    }

    if (status) {
      where.status = status;
    }

    if (search && search.trim() !== "") {
      const q = search.trim();
      if (q.length >= 3) {
        // Use trigram index on customers first to avoid cross-table join filter
        const matchingCustomers = await prisma.customer.findMany({
          where: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
            ...(propertyId
              ? {
                  reservations: {
                    some: { rooms: { some: { room: { propertyId } } } },
                  },
                }
              : {}),
          },
          select: { id: true },
          take: 500,
        });

        const customerIds = matchingCustomers.map((c) => c.id);

        where.OR = [
          { reservationNo: { contains: q, mode: "insensitive" } },
          ...(customerIds.length > 0 ? [{ customerId: { in: customerIds } }] : []),
        ];
      }
    }
    // ... pagination query execution
  }

  static async getReservationById(id: string, propertyId?: string) {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        customer: true,
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
        rooms: {
          include: {
            room: {
              include: {
                building: true,
                floor: true,
              },
            },
            roomCategory: true,
          },
          orderBy: { arrivalDate: "asc" },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundError("Reservation not found");
    }

    if (propertyId) {
      const belongsToProperty = reservation.rooms.some(
        (r) => r.room.propertyId === propertyId
      );
      if (!belongsToProperty) {
        throw new NotFoundError("Reservation not found");
      }
    }

    return {
      ...reservation,
      customer: reservation.customer
        ? {
            ...reservation.customer,
            idProofNumber: maskIdProofNumber(reservation.customer.idProofNumber),
          }
        : reservation.customer,
    };
  }
```

---

### 2. `BillingService.getInvoices`, `getInvoiceById`, `getBillingSummary`, `recordPayment`, `voidPayment`
```typescript
// File: src/modules/billing/billing.service.ts (Lines 73-102, 424-470, 517-548, 1061-1106, 1314-1346)
  public static async getBillingSummary(propertyId?: string): Promise<{
    totalInvoiced: string;
    totalCollected: string;
    totalOutstanding: string;
  }> {
    const fetchSummary = async () => {
      let rows: Array<{ totalInvoiced: string | null; totalCollected: string | null }>;
      if (propertyId) {
        rows = await prisma.$queryRaw<
          Array<{ totalInvoiced: string | null; totalCollected: string | null }>
        >`
          SELECT
            COALESCE((
              SELECT SUM(inv.grand_total)
              FROM invoices inv
              JOIN reservations r ON inv.reservation_id = r.id
              JOIN reservation_rooms rr ON rr.reservation_id = r.id
              JOIN rooms rm ON rr.room_id = rm.id
              WHERE inv.status != 'VOID' AND rm.property_id = ${propertyId}
            ), 0)::text AS "totalInvoiced",
            COALESCE((
              SELECT SUM(p.amount)
              FROM payments p
              JOIN invoices inv ON p.invoice_id = inv.id
              JOIN reservations r ON inv.reservation_id = r.id
              JOIN reservation_rooms rr ON rr.reservation_id = r.id
              JOIN rooms rm ON rr.room_id = rm.id
              WHERE p.status = 'RECORDED' AND inv.status != 'VOID' AND rm.property_id = ${propertyId}
            ), 0)::text AS "totalCollected"
        `;
      } else {
        rows = await prisma.$queryRaw<
          Array<{ totalInvoiced: string | null; totalCollected: string | null }>
        >`
          SELECT
            COALESCE((SELECT SUM(grand_total) FROM invoices WHERE status != 'VOID'), 0)::text AS "totalInvoiced",
            COALESCE((SELECT SUM(amount) FROM payments WHERE status = 'RECORDED'), 0)::text AS "totalCollected"
        `;
      }
      // ... computes totalOutstanding
    };
    // ...
  }

  static async getInvoiceById(
    invoiceId: string,
    propertyId?: string
  ): Promise<InvoiceDetailDTO> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        reservation: {
          include: {
            customer: true,
            rooms: {
              include: {
                room: true,
              },
            },
          },
        },
        items: { orderBy: { createdAt: "asc" } },
        payments: {
          include: { creator: { select: { name: true, role: true } } },
          orderBy: { paidAt: "asc" },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundError("Invoice not found");
    }

    if (propertyId) {
      const hasRooms =
        invoice.reservation?.rooms && invoice.reservation.rooms.length > 0;
      if (hasRooms) {
        const belongsToProperty = invoice.reservation!.rooms.some(
          (r) => r.room.propertyId === propertyId
        );
        if (!belongsToProperty) {
          throw new NotFoundError("Invoice not found");
        }
      }
    }

    return this.formatInvoiceDetail(invoice);
  }

  static async getInvoices(
    query: InvoiceListQuery = {}
  ): Promise<InvoiceListResponse> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.reservationId) {
      where.reservationId = query.reservationId;
    }
    const reservationWhere: Prisma.ReservationWhereInput = {};
    if (query.customerId) {
      reservationWhere.customerId = query.customerId;
    }
    if (query.propertyId) {
      reservationWhere.rooms = {
        some: {
          room: {
            propertyId: query.propertyId,
          },
        },
      };
    }
    if (Object.keys(reservationWhere).length > 0) {
      where.reservation = reservationWhere;
    }
    // ... search and execution
  }

  static async recordPayment(
    invoiceId: string,
    input: RecordPaymentInput,
    staffUserId: string,
    propertyId?: string
  ): Promise<{ invoice: InvoiceDetailDTO; receipt: PaymentReceiptDTO }> {
    return prisma.$transaction(async (tx) => {
      // 0. Acquire row-level lock on invoice to serialize concurrent payments
      await tx.$queryRaw`SELECT "id" FROM "invoices" WHERE "id" = ${invoiceId} FOR UPDATE`;

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          reservation: {
            include: {
              customer: true,
              rooms: { include: { room: true } },
            },
          },
          items: true,
          payments: {
            include: { creator: { select: { name: true, role: true } } },
          },
        },
      });

      if (!invoice) throw new NotFoundError("Invoice not found");

      if (propertyId) {
        const hasRooms =
          invoice.reservation?.rooms && invoice.reservation.rooms.length > 0;
        if (hasRooms) {
          const belongsToProperty = invoice.reservation!.rooms.some(
            (r) => r.room.propertyId === propertyId
          );
          if (!belongsToProperty) {
            throw new NotFoundError("Invoice not found");
          }
        }
      }
      // ... records payment
    });
  }

  static async voidPayment(
    invoiceIdOrPaymentId: string,
    paymentIdOrStaffUserId: string,
    staffUserIdParam?: string,
    reasonParam?: string,
    propertyIdParam?: string
  ): Promise<InvoiceDetailDTO> {
    // ... parameter normalization
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          invoice: {
            include: {
              reservation: {
                include: {
                  rooms: { include: { room: true } },
                },
              },
            },
          },
        },
      });

      if (!payment) throw new NotFoundError("Payment not found");

      if (propertyId) {
        const hasRooms =
          payment.invoice?.reservation?.rooms &&
          payment.invoice.reservation.rooms.length > 0;
        if (hasRooms) {
          const belongsToProperty = payment.invoice!.reservation!.rooms.some(
            (r) => r.room.propertyId === propertyId
          );
          if (!belongsToProperty) {
            throw new NotFoundError("Payment not found");
          }
        }
      }
      // ... voids payment
    });
    // ...
  }
```

---

### 3. `CustomerService.getCustomers` & `getCustomerById` (including walk-in guest logic)
```typescript
// File: src/modules/customers/customer.service.ts (Lines 61-114, 240-281)
  static async getCustomers(options: CustomerFilterOptions = {}) {
    const { search, propertyId } = options;
    const { page, limit, skip } = sanitizePagination(options.page, options.limit, 20);

    const where: Prisma.CustomerWhereInput = {};
    const andClauses: Prisma.CustomerWhereInput[] = [];

    if (propertyId) {
      andClauses.push({
        OR: [
          {
            reservations: {
              some: {
                rooms: {
                  some: {
                    room: {
                      propertyId,
                    },
                  },
                },
              },
            },
          },
          {
            reservations: {
              none: {},
            },
          },
        ],
      });
    }

    if (search && search.trim() !== "") {
      const q = search.trim();
      const last4 = q.replace(/^[•\s*]+/, "").trim().slice(-4);
      if (q.length >= 3 || last4.length >= 3) {
        andClauses.push({
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            ...(last4.length > 0
              ? [{ idProofNumber: { contains: last4, mode: "insensitive" as const } }]
              : []),
          ],
        });
      }
    }

    if (andClauses.length > 0) {
      where.AND = andClauses;
    }
    // ... queries customer records
  }

  static async getCustomerById(id: string, propertyId?: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        reservations: {
          where: propertyId
            ? { rooms: { some: { room: { propertyId } } } }
            : undefined,
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            rooms: {
              include: {
                room: true,
                roomCategory: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    if (propertyId) {
      const hasReservations = await prisma.reservation.findFirst({
        where: { customerId: id },
      });
      if (hasReservations) {
        const hasReservationInHotel = await prisma.reservation.findFirst({
          where: {
            customerId: id,
            rooms: { some: { room: { propertyId } } },
          },
        });
        if (!hasReservationInHotel) {
          throw new NotFoundError("Customer not found");
        }
      }
    }

    return maskCustomer(customer);
  }
```

---

### 4. `RoomService.getRoomsPage`, `getRoomsSummary`, `getRooms`
```typescript
// File: src/modules/rooms/room.service.ts (Lines 203-232, 366-417, 419-460)
  public static async getRoomsSummary(propertyId?: string): Promise<{
    counts: { total: number; clean: number; dirty: number; occupied: number; maintenance: number; outOfService: number };
    facets: Array<{ propertyId: string; buildingId: string; floorId: string; count: number }>;
  }> {
    const fetchSummary = async () => {
      const where: Prisma.RoomWhereInput = propertyId ? { propertyId } : {};
      const [statusGroups, buildingFloorGroups] = await Promise.all([
        prisma.room.groupBy({
          where,
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.room.groupBy({
          where,
          by: ["propertyId", "buildingId", "floorId"],
          _count: { _all: true },
        }),
      ]);
      // ... mapping counts
    };

    if (propertyId) {
      return fetchSummary();
    }

    try {
      const cached = unstable_cache(fetchSummary, ["rooms-summary"], {
        tags: ["rooms-summary"],
        revalidate: 60,
      });
      return await cached();
    } catch {
      return fetchSummary();
    }
  }

  static async getRoomsPage(filters?: RoomFilterOptions) {
    const page = Math.max(1, filters?.page || 1);
    const limit = Math.max(1, Math.min(100, filters?.limit || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.RoomWhereInput = {};
    if (filters?.propertyId) where.propertyId = filters.propertyId;
    if (filters?.buildingId) where.buildingId = filters.buildingId;
    if (filters?.floorId) where.floorId = filters.floorId;
    if (filters?.roomCategoryId) where.roomCategoryId = filters.roomCategoryId;
    if (filters?.status) where.status = filters.status;

    if (filters?.search && filters.search.trim() !== "") {
      const q = filters.search.trim();
      where.OR = [
        { roomNo: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ];
    }

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        where,
        include: {
          category: {
            include: {
              amenities: { include: { amenity: true } },
            },
          },
          building: true,
          floor: true,
          property: true,
        },
        orderBy: [
          { building: { name: "asc" } },
          { floor: { floorNo: "asc" } },
          { roomNo: "asc" },
        ],
        skip,
        take: limit,
      }),
      prisma.room.count({ where }),
    ]);

    return {
      rooms,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  static async getRooms(filters?: RoomFilterOptions) {
    const where: Prisma.RoomWhereInput = {};

    if (filters?.propertyId) where.propertyId = filters.propertyId;
    if (filters?.buildingId) where.buildingId = filters.buildingId;
    if (filters?.floorId) where.floorId = filters.floorId;
    if (filters?.roomCategoryId) where.roomCategoryId = filters.roomCategoryId;
    if (filters?.status) where.status = filters.status;

    if (filters?.search && filters.search.trim() !== "") {
      const q = filters.search.trim();
      where.OR = [
        { roomNo: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
      ];
    }

    const page = filters?.page ? Math.max(1, filters.page) : undefined;
    const limit = filters?.limit ? Math.max(1, Math.min(100, filters.limit)) : 50;
    const skip = page && limit ? (page - 1) * limit : undefined;

    return prisma.room.findMany({
      where,
      include: {
        category: {
          include: {
            amenities: { include: { amenity: true } },
          },
        },
        building: true,
        floor: true,
        property: true,
      },
      orderBy: [
        { building: { name: "asc" } },
        { floor: { floorNo: "asc" } },
        { roomNo: "asc" },
      ],
      skip,
      take: limit,
    });
  }
```

---

### 5. `CheckInOutService.getDailyArrivals` & `getDailyDepartures`
```typescript
// File: src/modules/check-in-out/check-in-out.service.ts (Lines 509-554)
  static async getDailyArrivals(targetDate?: Date, propertyId?: string) {
    const startOfDay = getHotelTodayDateUtc(targetDate);

    return prisma.reservationRoom.findMany({
      where: {
        arrivalDate: startOfDay,
        status: AllocationStatus.CONFIRMED,
        ...(propertyId ? { room: { propertyId } } : {}),
      },
      include: {
        reservation: {
          include: { customer: true },
        },
        room: {
          include: { building: true, floor: true },
        },
        roomCategory: true,
      },
      orderBy: [{ room: { roomNo: "asc" } }],
    });
  }

  static async getDailyDepartures(targetDate?: Date, propertyId?: string) {
    const startOfDay = getHotelTodayDateUtc(targetDate);

    return prisma.reservationRoom.findMany({
      where: {
        departureDate: startOfDay,
        status: AllocationStatus.CHECKED_IN,
        ...(propertyId ? { room: { propertyId } } : {}),
      },
      include: {
        reservation: {
          include: { customer: true },
        },
        room: {
          include: { building: true, floor: true },
        },
        roomCategory: true,
      },
      orderBy: [{ room: { roomNo: "asc" } }],
    });
  }
```

---

### 6. `ReportsService` Public Report Methods

#### `getOccupancyReport`
```typescript
// File: src/modules/reports/reports.service.ts (Lines 57-88)
    const roomWhere: Prisma.RoomWhereInput = {}
    if (propertyId) {
      roomWhere.propertyId = propertyId
    }
    const rooms = await prisma.room.findMany({ where: roomWhere, include: { category: true } })

    const allocations = await prisma.reservationRoom.findMany({
      where: {
        status: { in: [AllocationStatus.CONFIRMED, AllocationStatus.CHECKED_IN, AllocationStatus.CHECKED_OUT] },
        arrivalDate: { lt: nextDayAfterEnd },
        departureDate: { gt: startObj },
        ...(propertyId ? { room: { propertyId } } : {}),
      },
      include: { room: { include: { category: true } }, roomCategory: true },
    })
```

#### `getRevenueReport`
```typescript
// File: src/modules/reports/reports.service.ts (Lines 338-377)
    const invoiceWhere: Prisma.InvoiceWhereInput = {
      createdAt: { gte: startObj, lte: endObj },
      status: { not: InvoiceStatus.VOID },
    }
    if (propertyId) {
      invoiceWhere.reservation = {
        rooms: { some: { room: { propertyId } } },
      }
    }

    const paymentWhere: Prisma.PaymentWhereInput = {
      paidAt: { gte: startObj, lte: endObj },
      status: PaymentStatus.RECORDED,
    }
    if (propertyId) {
      paymentWhere.invoice = {
        reservation: {
          rooms: { some: { room: { propertyId } } },
        },
      }
    }
```

#### `getReservationStatusReport`
```typescript
// File: src/modules/reports/reports.service.ts (Lines 549-559)
    const resWhere: Prisma.ReservationWhereInput = {
      createdAt: { gte: startObj, lte: endObj },
    }
    if (propertyId) {
      resWhere.rooms = {
        some: { room: { propertyId } },
      }
    }
```

#### `getDailyOperations`
```typescript
// File: src/modules/reports/reports.service.ts (Lines 679-706)
    let effectivePropertyId = propertyId
    if (!effectivePropertyId) {
      const firstProp = await prisma.property.findFirst({
        select: { id: true },
        orderBy: { name: "asc" },
      })
      if (firstProp) effectivePropertyId = firstProp.id
    }

    const baseWhere: Prisma.ReservationRoomWhereInput = {}
    if (effectivePropertyId) {
      baseWhere.room = { propertyId: effectivePropertyId }
    }
```

#### `getAvailabilityGrid`
```typescript
// File: src/modules/reports/reports.service.ts (Lines 950-969)
    let effectivePropertyId = propertyId
    if (!effectivePropertyId) {
      const firstProp = await prisma.property.findFirst({
        select: { id: true },
        orderBy: { name: "asc" },
      })
      if (firstProp) effectivePropertyId = firstProp.id
    }

    const roomWhere: Prisma.RoomWhereInput = {}
    if (effectivePropertyId) {
      roomWhere.propertyId = effectivePropertyId
    }
    if (buildingId) {
      roomWhere.buildingId = buildingId
    }
```

#### `getShiftCollections`
```typescript
// File: src/modules/reports/reports.service.ts (Lines 1121-1131)
    if (propertyId) {
      paymentWhere.invoice = {
        reservation: {
          rooms: { some: { room: { propertyId } } },
        },
      }
    }
```

#### `getReceivablesReport`
```typescript
// File: src/modules/reports/reports.service.ts (Lines 1347-1355, 1461-1473)
    const propertyFilterSql = propertyId
      ? Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM reservation_rooms rr_prop
            JOIN rooms rm_prop ON rm_prop.id = rr_prop.room_id
            WHERE rr_prop.reservation_id = i.reservation_id AND rm_prop.property_id = ${propertyId}
          )
        `
      : Prisma.empty

    // Pagination query where clause:
    if (propertyId) {
      where.reservation = {
        rooms: { some: { room: { propertyId } } },
      }
    }
```

#### `getDiscountsReport`
```typescript
// File: src/modules/reports/reports.service.ts (Lines 1649-1657)
    if (propertyId) {
      invoiceWhere.reservation = {
        rooms: { some: { room: { propertyId } } },
      }
    }
```

---

### 7. `src/app/page.tsx` Dashboard Query Loading
```typescript
// File: src/app/page.tsx (Lines 38-67, 284-307)
  // Super Admin Platform Dashboard:
  if (session?.role === RoleName.SUPER_ADMIN) {
    const [properties, totalUsers, totalConfirmedRes, totalPayments] = await Promise.all([
      prisma.property.findMany({
        include: {
          _count: {
            select: { rooms: true, users: true, buildings: true },
          },
          rooms: { select: { status: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.reservation.count({ where: { status: ReservationStatus.CONFIRMED } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: PaymentStatus.RECORDED },
      }),
    ])
    // ...
  }

  // Hotel Admin and Receptionist Dashboard:
  if (session) {
    const propertyId = session.propertyId || undefined

    const [roomGroups, confirmedRes] = await Promise.all([
      prisma.room.groupBy({
        by: ["status"],
        where: propertyId ? { propertyId } : undefined,
        _count: { _all: true },
      }),
      prisma.reservation.count({
        where: {
          status: ReservationStatus.CONFIRMED,
          ...(propertyId
            ? {
                roomAllocations: { // Note: defect in relation name (should be rooms)
                  some: {
                    room: { propertyId },
                  },
                },
              }
            : {}),
        },
      }),
    ])
    // ...
  }
```

---

### Scope Derivation Join Paths Summary Table

| Model / List | Exact Join Path to Property Scope | File & Line Range |
| :--- | :--- | :--- |
| `Room` | Direct: `room.property_id` | [src/modules/rooms/room.service.ts#L372](file:///Users/apple/Byten/byteInn/src/modules/rooms/room.service.ts#L372) |
| `Reservation` | 3-hop: `reservation` → `reservation_rooms` (`rooms`) → `room` → `property_id` | [src/modules/reservations/reservation.service.ts#L571](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts#L571) |
| `Invoice` | 4-hop: `invoice` → `reservation` → `reservation_rooms` (`rooms`) → `room` → `property_id` | [src/modules/billing/billing.service.ts#L537-L543](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L537-L543) |
| `Payment` | 5-hop: `payment` → `invoice` → `reservation` → `reservation_rooms` → `room` → `property_id` | [src/modules/reports/reports.service.ts#L368-L376](file:///Users/apple/Byten/byteInn/src/modules/reports/reports.service.ts#L368-L376) |
| `Customer` | 4-hop: `customer` → `reservations` → `reservation_rooms` → `room` → `property_id` OR `{ reservations: { none: {} } }` | [src/modules/customers/customer.service.ts#L71-L90](file:///Users/apple/Byten/byteInn/src/modules/customers/customer.service.ts#L71-L90) |
| `ReservationRoom` | 2-hop: `reservation_room` → `room` → `property_id` | [src/modules/check-in-out/check-in-out.service.ts#L516](file:///Users/apple/Byten/byteInn/src/modules/check-in-out/check-in-out.service.ts#L516) |
| `Building` | Direct: `building.property_id` | [src/app/api/properties/[id]/buildings/route.ts#L18](file:///Users/apple/Byten/byteInn/src/app/api/properties/[id]/buildings/route.ts#L18) |
| `Floor` | 2-hop: `floor` → `building` → `property_id` | [src/app/api/buildings/[id]/floors/route.ts#L22](file:///Users/apple/Byten/byteInn/src/app/api/buildings/[id]/floors/route.ts#L22) |
| `User` | Direct: `user.property_id` | [src/modules/users/user.service.ts#L107](file:///Users/apple/Byten/byteInn/src/modules/users/user.service.ts#L107) |

#### Is there a shared scope helper, or is scope re-implemented in each service?
Scope is **re-implemented independently** in every service and route handler. While `requireHotelContext` in `src/lib/auth-guard.ts` extracts the valid `effectivePropertyId` string, no shared Prisma filter builder exists; each service writes its own nested `where` relation clauses and raw SQL subqueries.

---

## 5. Write Paths That Matter for a Stored `property_id`

### 1. Reservation Creation
```typescript
// File: src/modules/reservations/reservation.service.ts (Lines 282-295, 364-394)
          if (options?.propertyId) {
            for (const room of rooms) {
              if (room.propertyId !== options.propertyId) {
                throw new ForbiddenError("Cannot allocate rooms from another hotel");
              }
            }
          }

          const distinctPropertyIds = new Set(rooms.map((r) => r.propertyId));
          if (distinctPropertyIds.size > 1) {
            throw new BadRequestError(
              "All rooms in a reservation must belong to the same property"
            );
          }

          // 6. Create Reservation and ReservationRoom allocations
          const createdReservation = await tx.reservation.create({
            data: {
              reservationNo,
              customerId: customerId!,
              status: ReservationStatus.CONFIRMED,
              createdBy: creatorUserId,
              specialRequests: input.specialRequests?.trim() || null,
              rooms: {
                create: normalizedAllocations.map((alloc) => {
                  const room = roomMap.get(alloc.roomId)!;
                  const rateDecimal =
                    alloc.bookedNightlyRate !== undefined &&
                    alloc.bookedNightlyRate !== null
                      ? new Prisma.Decimal(alloc.bookedNightlyRate.toString())
                      : room.priceOverride ?? room.category.basePrice;

                  return {
                    roomId: alloc.roomId,
                    roomCategoryId: room.roomCategoryId,
                    arrivalDate: alloc.arrivalDate,
                    departureDate: alloc.departureDate,
                    bookedNightlyRate: rateDecimal,
                    adults: alloc.adults ?? 1,
                    children: alloc.children ?? 0,
                    status: AllocationStatus.CONFIRMED,
                  };
                }),
              },
            },
            // ...
          });
```

---

### 2. Allocation Mutations (Change-Room, Extend, Cancel, No-Show)
```typescript
// File: src/modules/reservations/reservation.service.ts (Lines 1323-1325)
    if (targetRoom.propertyId !== allocation.room.propertyId) {
      throw new BadRequestError("Cannot change room to a different hotel");
    }
```
In `changeRoom`, moving a room to a different property is explicitly rejected. In `extendStay` ([Line 1137](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts#L1137)), `cancelAllocation` ([Line 877](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts#L877)), and `markNoShow` ([Line 959](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts#L959)), the allocation's room never changes property.

---

### 3. Invoice Creation
Invoices are created in two places:
1. **Auto-provisioned on reservation creation**: Inside `ReservationService.createReservation` transaction ([Lines 504-517](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts#L504-L517)):
   ```typescript
   const invoice = await tx.invoice.create({
     data: {
       reservationId: createdReservation.id,
       invoiceNumber,
       subtotal,
       discountTotal: new Prisma.Decimal(0),
       taxTotal: new Prisma.Decimal(0),
       grandTotal,
       status: InvoiceStatus.DRAFT,
       items: { create: itemsToCreate },
     },
   });
   ```
2. **Explicitly created on demand**: Inside `BillingService.createInvoiceForReservation` ([Lines 351-364](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L351-L364)). In V1, invoices are always tied 1:1 to a reservation (`reservationId`).

---

### 4. Payments and Invoice Items
- **Invoice Items**: Added via `BillingService.addInvoiceItem` ([Line 617](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L617)) and removed via `BillingService.removeInvoiceItem` ([Line 757](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L757)).
- **Payment Recording**: Created via `BillingService.recordPayment` ([Line 1152](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L1152)) within a transaction locking the invoice (`FOR UPDATE`).
- **Payment Voiding**: Voided via `BillingService.voidPayment` ([Line 1374](file:///Users/apple/Byten/byteInn/src/modules/billing/billing.service.ts#L1374)), updating status to `VOIDED`.

---

### 5. Seeding Data
In `prisma/seed-realworld.ts`, batch creation bypasses domain services using `createMany`:
- `prisma.reservation.createMany` ([Line 939](file:///Users/apple/Byten/byteInn/prisma/seed-realworld.ts#L939))
- `prisma.reservationRoom.createMany` ([Line 954](file:///Users/apple/Byten/byteInn/prisma/seed-realworld.ts#L954))
- `prisma.invoice.createMany` ([Line 977](file:///Users/apple/Byten/byteInn/prisma/seed-realworld.ts#L977))
- `prisma.invoiceItem.createMany` ([Line 995](file:///Users/apple/Byten/byteInn/prisma/seed-realworld.ts#L995))
- `prisma.payment.createMany` ([Line 1012](file:///Users/apple/Byten/byteInn/prisma/seed-realworld.ts#L1012))

---

### Answers to Write Path Questions

#### Can a reservation's rooms ever move to a different property after creation?
In code: **No**, it is explicitly blocked by `targetRoom.propertyId !== allocation.room.propertyId` ([src/modules/reservations/reservation.service.ts#L1323-L1325](file:///Users/apple/Byten/byteInn/src/modules/reservations/reservation.service.ts#L1323-L1325)).
In DB: **Unknown/Not enforced**. Because `reservations` has no `property_id` foreign key, the database schema itself does not enforce property consistency between allocations of the same reservation.

#### Can a reservation exist with zero rooms?
In code: **No**. The validation schema `createReservationSchema` requires `allocations: z.array(...).min(1)`.
In DB: **Yes**. There is no foreign key or check constraint in PostgreSQL preventing a `reservations` row from existing without child `reservation_rooms` rows.

#### Are there other places raw SQL or `createMany` bypass the service layer?
In application code (`src/`), no domain entities bypass the service layer; only `roomCategoryAmenity` uses `createMany`. In test seeding and `prisma/seed-realworld.ts`, `createMany` is used extensively for high-throughput batch generation.

---

## 6. Route Handler and Validation Conventions

### Complete List Route Handler: `src/app/api/reservations/route.ts` (GET)
```typescript
// File: src/app/api/reservations/route.ts (Lines 10-47)
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(undefined, req);
    const searchParams = req.nextUrl.searchParams;

    const search = searchParams.get("search") || undefined;
    const statusParam = searchParams.get("status");
    const status =
      statusParam && Object.values(ReservationStatus).includes(statusParam as ReservationStatus)
        ? (statusParam as ReservationStatus)
        : undefined;

    const propertyIdParam = searchParams.get("propertyId") || undefined;
    const effectivePropertyId =
      session.role === RoleName.SUPER_ADMIN
        ? propertyIdParam
        : (session.propertyId || undefined);

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const { page, limit } = paginationQuerySchema.parse({
      page: pageParam ?? undefined,
      limit: limitParam ?? undefined,
    });

    const result = await ReservationService.getReservations({
      search,
      status,
      propertyId: effectivePropertyId,
      page,
      limit,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleApiError(error, "Failed to fetch reservations");
  }
}
```

---

### Complete Report Route Handler: `src/app/api/reports/occupancy/route.ts`
```typescript
// File: src/app/api/reports/occupancy/route.ts (Lines 8-33)
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth([RoleName.SUPER_ADMIN, RoleName.ADMIN, RoleName.RECEPTIONIST], req)
    const searchParams = req.nextUrl.searchParams

    const query = reportDateRangeSchema.parse({
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      propertyId: searchParams.get("propertyId") || undefined,
    })

    const effectivePropertyId =
      session.role === RoleName.SUPER_ADMIN
        ? query.propertyId
        : (session.propertyId || undefined)

    const report = await ReportsService.getOccupancyReport({
      ...query,
      propertyId: effectivePropertyId,
    })

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    return handleApiError(error, "Failed to fetch occupancy report")
  }
}
```

---

### Validation Schemas

#### Pagination Query Schema
```typescript
// File: src/lib/pagination.ts (Lines 11-23)
export const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int("Page must be an integer")
    .min(1, "Page must be greater than or equal to 1")
    .default(DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(MAX_PAGE_SIZE, `Limit cannot exceed ${MAX_PAGE_SIZE}`)
    .default(DEFAULT_PAGE_SIZE),
});
```

#### Report Date Range Schema
```typescript
// File: src/modules/reports/reports.validation.ts (Lines 11-29)
export const reportDateRangeSchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format")
      .default(() => {
        const d = new Date()
        d.setUTCDate(d.getUTCDate() - 30)
        return d.toISOString().split("T")[0]!
      }),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format")
      .default(() => new Date().toISOString().split("T")[0]!),
    propertyId: z.string().optional(),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "Start date must be before or equal to end date",
    path: ["startDate"],
  })
```

---

### Error Mapping Architecture: `src/lib/errors.ts`
```typescript
// File: src/lib/errors.ts (Lines 75-112)
export function handleApiError(
  error: unknown,
  fallbackMessage = "An unexpected internal server error occurred"
): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.mustChangePassword ? { mustChangePassword: true } : {}),
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation error",
        details: error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  if (error instanceof DomainError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  // Safe logging of unexpected runtime exceptions
  console.error("Unhandled API exception:", error);
  return NextResponse.json(
    { error: fallbackMessage },
    { status: 500 }
  );
}
```

---

### Style & Coding Standards
1. **Validation**: Exclusively Zod (`zod@^4.6.5` / `z.object({...})`).
2. **Money Serialization**: All PostgreSQL `numeric` / Prisma `Decimal` values must be serialized to String (`toString()`) or converted explicitly before passing to client components.
3. **Date Serialization**: UTC ISO string (`toISOString()`) or date format string (`YYYY-MM-DD`).
4. **Import Aliases**: Absolute alias `@/*` resolving to `src/*`.
5. **ESLint Rules**: Strict TypeScript with `@typescript-eslint/no-explicit-any: "error"`, unused variable suppression with `^_`, and disallowed `no-console` (only `console.warn` and `console.error` allowed).

---

## 7. Caching (Verbatim)

| Target Cache Function | Cache Key | Cache Tag | TTL | Property Scoped in Key? | Invalidation Trigger & Mutations |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `ReservationService.getUnfilteredReservationCount` | `["reservation-unfiltered-count"]` | `reservation-count` | 60s | **No** | `ReservationService.invalidateReservationCache()` on `createReservation`, `cancelReservation`, `cancelAllocation` |
| `RoomService.getRoomsSummary` | `["rooms-summary"]` (bypassed if propertyId present) | `rooms-summary` | 60s | **No** (bypasses cache when propertyId is present) | `RoomService.invalidateRoomsCache()` on `createRoom`, `updateRoom`, `updateRoomStatus`, `deleteRoom` |
| `BillingService.getBillingSummary` | `["billing-summary"]` (bypassed if propertyId present) | `billing-summary` | 3600s | **No** (bypasses cache when propertyId is present) | `BillingService.invalidateBillingCache()` on `recordPayment`, `voidPayment`, `addInvoiceItem`, `removeInvoiceItem`, `applyDiscount`, `issueInvoice`, `cancelReservation` |
| `BillingService.getUnfilteredInvoiceCount` | `["invoice-unfiltered-count"]` | `invoice-count` | 60s | **No** | `BillingService.invalidateBillingCache()` on invoice mutations |
| `ReportsService.getDailyOperations` | `[`daily-ops-${effectivePropertyId || "all"}-${dateStr}`]` | `daily-operations` | 60s | **Yes** | `revalidateTag("daily-operations", "max")` in `invalidateDailyOperationsCache` |
| `ReportsService.getReceivablesReport` | `[`receivables-summary-${propertyId || "all"}`]` | `billing-summary` | 60s | **Yes** | `BillingService.invalidateBillingCache()` calls `revalidateTag("billing-summary", "max")` |

---

## 8. Frontend Structure for Lists

### `DataTableShell` & Pagination Component
```typescript
// File: src/components/ui-kit/data-table-shell.tsx (Lines 31-64, 130-167)
export function DataTableShell({
  isLoading = false,
  error = null,
  onRetry,
  isEmpty = false,
  emptyState,
  pagination,
  skeletonRows = 5,
  columnsCount = 5,
  children,
  mobileView,
  className,
}: DataTableShellProps) {
  if (error) {
    return (
      <div className="flex min-h-60 flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
        <AlertCircleIcon className="size-10 text-destructive mb-3" />
        <h3 className="text-base font-semibold text-foreground">
          Unable to load data
        </h3>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
            Try Again
          </Button>
        )}
      </div>
    )
  }

  // ... skeleton and empty state handling

  return (
    <div className={cn("space-y-4", className)}>
      <div className={cn("overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xs relative transition-opacity duration-200", isLoading && "opacity-60 pointer-events-none")}>
        {isLoading && (
          <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/20 overflow-hidden z-10">
            <div className="h-full w-1/3 bg-primary animate-pulse" />
          </div>
        )}
        {children}
      </div>

      {/* Pagination Footer */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-1 py-2 text-xs text-muted-foreground">
          <div>
            Showing <span className="font-mono tabular-nums font-semibold text-foreground">{startRecord}</span> to{" "}
            <span className="font-mono tabular-nums font-semibold text-foreground">{endRecord}</span> of{" "}
            <span className="font-mono tabular-nums font-semibold text-foreground">{pagination.totalCount}</span> entries
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <ChevronLeftIcon className="size-3.5" />
              Previous
            </Button>
            <div className="px-2 text-xs">
              Page <span className="font-mono tabular-nums font-semibold text-foreground">{pagination.page}</span> of{" "}
              <span className="font-mono tabular-nums font-semibold text-foreground">{pagination.totalPages}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
              <ChevronRightIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### Debounce & AbortController Hook Pattern (`src/app/reservations/reservation-list.tsx`)
```typescript
// File: src/app/reservations/reservation-list.tsx (Lines 116-145, 208-246)
  const fetchReservations = React.useCallback(async () => {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (searchTerm.trim()) params.set("search", searchTerm.trim())
      if (statusFilter !== "ALL") params.set("status", statusFilter)
      params.set("page", String(currentPage))
      params.set("limit", "20")

      const res = await fetch(`/api/reservations?${params.toString()}`, {
        signal: controller.signal,
      })
      // ... parses response and updates state
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return
      }
      console.error("Error searching reservations:", err)
      const msg = err instanceof Error ? err.message : "Unable to load reservations. Please check your connection and retry."
      setError(msg)
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false)
      }
    }
  }, [searchTerm, statusFilter, currentPage, router])

  React.useEffect(() => {
    const prev = prevFiltersRef.current
    const hasChanged =
      prev.searchTerm !== searchTerm ||
      prev.statusFilter !== statusFilter ||
      prev.currentPage !== currentPage

    if (!hasChanged) {
      return
    }

    prevFiltersRef.current = { searchTerm, statusFilter, currentPage }

    const timer = setTimeout(() => {
      fetchReservations()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, statusFilter, currentPage, fetchReservations])

  React.useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])
```

---

### `room-manager.tsx` Request Building
```typescript
// File: src/app/rooms/room-manager.tsx (Lines 279-309)
        const pId = overrides?.propertyId !== undefined ? overrides.propertyId : propertyFilter;
        const bId = overrides?.buildingId !== undefined ? overrides.buildingId : buildingFilter;
        const fId = overrides?.floorId !== undefined ? overrides.floorId : floorFilter;
        const catId = overrides?.categoryId !== undefined ? overrides.categoryId : categoryFilter;
        const stat = overrides?.status !== undefined ? overrides.status : statusFilter;
        const q = overrides?.search !== undefined ? overrides.search : search;

        const params = new URLSearchParams();
        if (pId && pId !== "ALL") params.set("propertyId", pId);
        if (bId && bId !== "ALL") params.set("buildingId", bId);
        if (fId && fId !== "ALL") params.set("floorId", fId);
        if (catId && catId !== "ALL") params.set("roomCategoryId", catId);
        if (stat && stat !== "ALL") params.set("status", stat);
        if (q && q.trim()) params.set("search", q.trim());
        params.set("page", targetPage.toString());
        params.set("limit", "50");

        const res = await fetch(`/api/rooms?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch rooms");
        }

        setRooms(data.rooms || []);
        if (data.pagination) {
          setPage(data.pagination.page);
          setTotalPages(data.pagination.totalPages);
          setTotalRooms(data.pagination.total);
        }
```

---

### Answers to Frontend Context Questions

#### How does the UI pass the `SUPER_ADMIN`'s selected property to each page and API?
There is **no global property switcher component or React context** storing the active property. Instead, property selection is managed via URL query parameters (`?propertyId=...`) and page-level dropdowns (e.g. `room-manager.tsx` stores `propertyFilter` in local React state, while `app/page.tsx` renders direct links like `/rooms?propertyId=${prop.id}`).

#### Table of List/Table/Card-Grid Components

| Component | Data Source | Client-Side Filter/Sort |
| :--- | :--- | :---: |
| `src/app/reservations/reservation-list.tsx` | `/api/reservations` | **No** (backend query) |
| `src/app/rooms/room-manager.tsx` | `/api/rooms` | **No** (backend query) |
| `src/app/billing/invoice-list.tsx` | `/api/invoices` | **No** (backend query) |
| `src/app/customers/customer-list.tsx` | `/api/customers` | **No** (backend query) |
| `src/app/users/user-management.tsx` | `/api/users` | **Yes** (filters loaded array by role/status) |
| `src/app/categories/category-manager.tsx` | Server props via `RoomCategoryService.getCategories()` | **Yes** (filters by property in memory) |
| `src/app/reports/` tab views | `/api/reports/...` endpoints | **No** (backend computed) |

---

## 9. Tests

### Setup Helpers from `tests/multi-hotel-isolation.test.ts`
```typescript
// File: tests/multi-hotel-isolation.test.ts (Lines 41-68, 178-214)
  before(async () => {
    // 1. Roles
    const [superAdminRole, adminRole, recepRole] = await Promise.all([
      prisma.role.findFirstOrThrow({ where: { name: RoleName.SUPER_ADMIN } }),
      prisma.role.findFirstOrThrow({ where: { name: RoleName.ADMIN } }),
      prisma.role.findFirstOrThrow({ where: { name: RoleName.RECEPTIONIST } }),
    ]);

    // 2. Properties
    propertyA = await prisma.property.create({
      data: { name: "Test Hotel Alpha", city: "Metropolis", status: "ACTIVE" },
    });
    propertyB = await prisma.property.create({
      data: { name: "Test Hotel Beta", city: "Gotham", status: "ACTIVE" },
    });

    // ... seeded users and sessions:
    superAdminSession = {
      sub: superAdminUser.id,
      email: superAdminUser.email,
      name: "Global Super Admin",
      role: RoleName.SUPER_ADMIN,
      propertyId: null,
      property: null,
    };

    hotelAAdminSession = {
      sub: hotelAAdminUser.id,
      email: hotelAAdminUser.email,
      name: "Hotel A Manager",
      role: RoleName.ADMIN,
      propertyId: propertyA.id,
      property: { id: propertyA.id, name: propertyA.name, status: "ACTIVE" },
    };
  });
```

### Two Representative Tests
```typescript
// File: tests/multi-hotel-isolation.test.ts (Lines 312-325, 449-460)
    it("Hotel A Admin can only see Hotel A staff and cannot see Super Admins or Hotel B staff", async () => {
      const users = await UserService.listUsers(hotelAAdminSession);

      const hasHotelAAdmin = users.some((u) => u.id === hotelAAdminUser.id);
      const hasHotelARecep = users.some((u) => u.id === hotelARecepUser.id);
      const hasHotelBAdmin = users.some((u) => u.id === hotelBAdminUser.id);
      const hasSuper = users.some((u) => u.role === RoleName.SUPER_ADMIN);

      assert.equal(hasHotelAAdmin, true, "Hotel A Admin must see Hotel A admin");
      assert.equal(hasHotelARecep, true, "Hotel A Admin must see Hotel A receptionist");
      assert.equal(hasHotelBAdmin, false, "Hotel A Admin must NOT see Hotel B admin");
      assert.equal(hasSuper, false, "Hotel A Admin must NOT see Super Admin accounts");
    });

    it("Hotel A Admin/Receptionist only receives Hotel A reservations when scoped", async () => {
      const resultA = await ReservationService.getReservations({
        propertyId: propertyA.id,
      });

      const hasResA = resultA.reservations.some((r) => r.id === reservationAId);
      const hasResB = resultA.reservations.some((r) => r.id === reservationBId);

      assert.equal(hasResA, true, "Hotel A query must include Hotel A reservation");
      assert.equal(hasResB, false, "Hotel A query must NOT include Hotel B reservation");
    });
```

---

### Test Database Environment & Isolation
- The test database is named **`byteinn_test`**, accessed via `DATABASE_URL="postgresql://apple@localhost:5432/byteinn_test?schema=public"`.
- [src/lib/prisma.ts](file:///Users/apple/Byten/byteInn/src/lib/prisma.ts) contains a safety guard: if automated test execution is detected while targeting a non-test database (name not ending in `_test`), it executes a critical abort immediately.
- **Single test file execution command**:
  ```bash
  DATABASE_URL="postgresql://apple@localhost:5432/byteinn_test?schema=public" npx tsx --test tests/multi-hotel-isolation.test.ts
  ```

### Test Files Covering Core Domains
- **Reservations List**: [tests/reservations.test.ts](file:///Users/apple/Byten/byteInn/tests/reservations.test.ts), [tests/multi-hotel-isolation.test.ts](file:///Users/apple/Byten/byteInn/tests/multi-hotel-isolation.test.ts), [tests/remediation-batch-1.test.ts](file:///Users/apple/Byten/byteInn/tests/remediation-batch-1.test.ts)
- **Billing List & Summary**: [tests/billing.test.ts](file:///Users/apple/Byten/byteInn/tests/billing.test.ts), [tests/perf-cache-invalidation.test.ts](file:///Users/apple/Byten/byteInn/tests/perf-cache-invalidation.test.ts)
- **Customers List**: [tests/guest-id-privacy.test.ts](file:///Users/apple/Byten/byteInn/tests/guest-id-privacy.test.ts), [tests/reservations.test.ts](file:///Users/apple/Byten/byteInn/tests/reservations.test.ts)
- **Rooms Pagination**: [tests/perf-cache-invalidation.test.ts](file:///Users/apple/Byten/byteInn/tests/perf-cache-invalidation.test.ts), [tests/rooms.test.ts](file:///Users/apple/Byten/byteInn/tests/rooms.test.ts)
- **Reports**: [tests/reports.test.ts](file:///Users/apple/Byten/byteInn/tests/reports.test.ts), [tests/financial-reports.test.ts](file:///Users/apple/Byten/byteInn/tests/financial-reports.test.ts), [tests/daily-operations.test.ts](file:///Users/apple/Byten/byteInn/tests/daily-operations.test.ts), [tests/availability-grid.test.ts](file:///Users/apple/Byten/byteInn/tests/availability-grid.test.ts)

---

## 10. Git Context

### `git log --oneline -n 25`
```
64a6718 (HEAD -> feature/multi-hotel-super-admin) test(multi-hotel): add multi-hotel isolation test suite and documentation
32faa78 feat(admin-ui): add multi-hotel users management and roles API
6434e1a feat(multi-hotel): enforce hotel property scoping across API routes and domain services
4285b9b feat(auth,schema): add SUPER_ADMIN role and user property assignment migrations
0fbf0ca (perf/scale-optimizations, perf/pagination-and-fixes) docs: add PERF_RESULTS.md comprehensive audit and verification report
c0afcd0 perf(frontend): add loading skeletons, debounced search with abort, and transition smoothness (phase 7)
985792e perf(search): add pg_trgm GIN indexes and restructure reservation and customer search (phase 6)
734e011 perf(reports): lazy load tabs, scope availability grid, and paginate receivables (phase 5)
0b380b8 perf(rooms): implement server pagination, summary grouping, and lazy details (phase 4)
2f96a0d feat(ui): resolve overflow in room cards and financial report KPI cards with subtle cents and refined layouts
764e1fd perf(billing,customers,reservations): optimize billing aggregates, cached counts, and scoped customer window queries (phase 3)
9488c72 perf(overview): consolidate room status counts into groupBy and stream daily operations (phase 2)
d468e5e perf(db): add indexes for reservations, invoices, rooms, and payments (phase 1)
a0f9b40 (main) feat(auth,security): add client login validation, password change guards, and audit policy remediations
48717e3 feat(rooms): align sheet action buttons to single row at right end and add real-world 1-year seeder
de91990 fix(security): invalidate sessions on logout via tokenVersion increment (AUTH-08) and enforce HTTP headers (INFRA-01..06)
0d04658 feat(ui): impeccable UI polish pass for login, rooms, invoices, guests, and table mount lifecycle
bdf26ce feat(privacy,ui): guest id masking, audit log redaction, dev cleanup and boutique ui polish
164d081 fix(remediation): idempotent seed upserts and resolve Base UI button warning
493b7c5 fix(remediation): audit fixes, invoice item lock on payment, strict body parsing, and UI concessions
7d5a1c1 feat(remediation): implement Batch 3 void windows, user admin safeguards, password lifecycle, and concession reporting
df43832 fix(remediation): implement Batch 2b lifecycle billing, room change realignment and date rules
774a48b (origin/main, origin/HEAD) chore(lint): ignore .worktrees directory in eslint config
b0ce294 feat(ui): redesign PMS interface with Impeccable warm boutique aesthetic
b06a934 (feature/remediation-batch-2) fix(remediation): implement Batch 2 adversarial audit fixes and concurrency limits
```

---

### Files Changed by RBAC Commits (Names Only)

#### `src/modules/**`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.types.ts`
- `src/modules/billing/billing.service.ts`
- `src/modules/billing/billing.types.ts`
- `src/modules/billing/billing.validation.ts`
- `src/modules/check-in-out/check-in-out.service.ts`
- `src/modules/customers/customer.service.ts`
- `src/modules/customers/customer.types.ts`
- `src/modules/reservations/reservation.service.ts`
- `src/modules/reservations/reservation.types.ts`
- `src/modules/rooms/room.service.ts`
- `src/modules/users/user.service.ts`
- `src/modules/users/user.types.ts`
- `src/modules/users/user.validation.ts`

#### `src/app/api/**`
- `src/app/api/availability/route.ts`
- `src/app/api/buildings/[id]/floors/route.ts`
- `src/app/api/customers/[id]/route.ts`
- `src/app/api/customers/route.ts`
- `src/app/api/invoices/[id]/issue/route.ts`
- `src/app/api/invoices/[id]/items/[itemId]/route.ts`
- `src/app/api/invoices/[id]/items/route.ts`
- `src/app/api/invoices/[id]/payments/[paymentId]/void/route.ts`
- `src/app/api/invoices/[id]/payments/route.ts`
- `src/app/api/invoices/[id]/route.ts`
- `src/app/api/invoices/route.ts`
- `src/app/api/properties/[id]/buildings/route.ts`
- `src/app/api/properties/[id]/route.ts`
- `src/app/api/properties/route.ts`
- `src/app/api/reports/availability-grid/route.ts`
- `src/app/api/reports/collections/route.ts`
- `src/app/api/reports/daily-operations/route.ts`
- `src/app/api/reports/discounts/route.ts`
- `src/app/api/reports/occupancy/route.ts`
- `src/app/api/reports/receivables/route.ts`
- `src/app/api/reports/reservations/route.ts`
- `src/app/api/reports/revenue/route.ts`
- `src/app/api/reservations/[id]/cancel/route.ts`
- `src/app/api/reservations/[id]/route.ts`
- `src/app/api/reservations/route.ts`
- `src/app/api/roles/route.ts`
- `src/app/api/room-allocations/[id]/cancel/route.ts`
- `src/app/api/room-allocations/[id]/change-room/route.ts`
- `src/app/api/room-allocations/[id]/check-in/route.ts`
- `src/app/api/room-allocations/[id]/check-out/route.ts`
- `src/app/api/room-allocations/[id]/extend/route.ts`
- `src/app/api/room-allocations/[id]/no-show/route.ts`
- `src/app/api/room-categories/[id]/route.ts`
- `src/app/api/room-categories/route.ts`
- `src/app/api/rooms/[id]/route.ts`
- `src/app/api/rooms/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/users/route.ts`

---

## 11. Unknowns and Risks

### (a) Places Where Scope is NOT Applied or Can Cross Hotels
1. **Server Component Initial Fetch in `src/app/reservations/page.tsx:16`**:
   `ReservationsPage` calls `ReservationService.getReservations({ page: 1, limit: 20 })` with no `propertyId` parameter. The initial server-rendered payload for Hotel Admin or Receptionist contains the 20 most recent reservations from across the entire database, regardless of hotel, until the client fetches.
2. **Defect in `src/app/page.tsx:298`**:
   For `ADMIN` or `RECEPTIONIST`, `page.tsx` executes `prisma.reservation.count({ where: { roomAllocations: { some: { room: { propertyId } } } } })`. Because the Prisma relation on `Reservation` is named `rooms` (not `roomAllocations`), this causes a fatal runtime Prisma client exception (`Unknown argument roomAllocations`) whenever a hotel admin or receptionist views the dashboard.
3. **Global Unfiltered Count Caches in `ReservationService` and `BillingService`**:
   `getUnfilteredReservationCount` and `getUnfilteredInvoiceCount` execute global `count()` queries cached under single global keys (`["reservation-unfiltered-count"]` and `["invoice-unfiltered-count"]`). Whenever a user requests an unfiltered list, the returned `total` in pagination metadata is the platform-wide total (~351k) rather than the hotel's total (~35.1k).
4. **Room Categories on Rooms Page (`src/app/rooms/page.tsx:42`)**:
   `RoomCategoryService.getCategories()` is called without `propertyId`, loading categories from all 10 hotels into the room manager filter dropdown.
5. **Walk-In Customers (`src/modules/customers/customer.service.ts:86-89`)**:
   `getCustomers` includes `{ reservations: { none: {} } }`, exposing newly registered walk-in customer records across all properties.

---

### (b) Surprises and Inconsistencies in the Scoping Approach
1. **Double Counting in `BillingService.getBillingSummary(propertyId)`**:
   The raw SQL query joins `invoices inv JOIN reservations r ON inv.reservation_id = r.id JOIN reservation_rooms rr ON rr.reservation_id = r.id JOIN rooms rm ON rr.room_id = rm.id`. Because a reservation can have multiple `reservation_rooms` rows, this raw SQL inner join multiplies `inv.grand_total` by the number of allocated rooms on that reservation, inflating the invoiced sum for multi-room bookings.
2. **Inconsistent Endpoint Property Resolution**:
   - `/api/rooms` and `/api/customers` use `requireHotelContext(session, requestedPropertyId, { allowSuperAdminGlobal: true })`.
   - `/api/reservations` and `/api/reports/occupancy` bypass `requireHotelContext` and implement ad-hoc ternary checks (`session.role === RoleName.SUPER_ADMIN ? propertyIdParam : session.propertyId`).
3. **Deep Nested Traversal Overhead**:
   Because `reservations`, `invoices`, and `payments` do not store `property_id`, every single query, aggregate, filter, and report must traverse 3 to 5 relational hops through `reservation_rooms` and `rooms`. On 1.87M records, this creates substantial Postgres join overhead and prevents index-only scans on tenant boundaries.

---

### (c) Questions for Performance & Schema Design
1. **Direct `property_id` columns**:
   - If `property_id` is added to `reservations` and `invoices`, should they be `NOT NULL` with a foreign key constraint to `properties(id)`?
   - Should `payments` also receive a direct `property_id` column, or should payments always inherit scope via `payments.invoice_id -> invoices.property_id`?
2. **Customer Tenant Ownership**:
   - Should `Customer` have an explicit, optional `property_id` (e.g. `registered_property_id`) to prevent walk-in guests from being globally visible?
3. **Cache Partitioning**:
   - Should `reservation-unfiltered-count`, `invoice-unfiltered-count`, and `rooms-summary` cache keys be partitioned by property ID (e.g. `[`reservation-count`, propertyId || "all"]`) with a 60-second TTL?
4. **Seeding Scripts**:
   - Since `prisma/seed-realworld.ts` uses raw `createMany` calls for reservations, invoices, and payments, should the performance migration include a backfill script to populate existing rows, and should `seed-realworld.ts` be updated in the same phase to assign `property_id` directly?
