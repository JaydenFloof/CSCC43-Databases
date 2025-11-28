import psycopg2

# ---- 1. Connection helper ----
def get_connection():
    # Adjust these if your DB name / user is different
    conn = psycopg2.connect(
        host="localhost",
        port=5433,
        dbname="stockdb",
        user="jayvuong15",   # the Linux user you used for initdb
        # password="...",    # only if you configured one; otherwise omit
    )
    return conn

# ---- 2. Simple operations ----
def register_user(conn):
    print("\n=== Register User ===")
    username = input("Choose a username: ")
    password = input("Choose a password: ")

    with conn.cursor() as cur:
        try:
            cur.execute(
                """
                INSERT INTO users (username, password)
                VALUES (%s, %s)
                RETURNING uid;
                """,
                (username, password),
            )
            uid = cur.fetchone()[0]
            conn.commit()
            print(f"✅ Registered user '{username}' with uid = {uid}")
        except psycopg2.Error as e:
            conn.rollback()
            print("❌ Error during registration:", e)

def list_users(conn):
    print("\n=== Users ===")
    with conn.cursor() as cur:
        cur.execute("SELECT uid, username FROM users ORDER BY uid;")
        rows = cur.fetchall()
        if not rows:
            print("(no users yet)")
        else:
            for uid, username in rows:
                print(f"uid={uid}, username={username}")

def show_stocks_sample(conn):
    print("\n=== Sample from stocks (5 rows) ===")
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT symbol, ts, open, high, low, close, volume
            FROM stocks
            ORDER BY symbol, ts
            LIMIT 5;
            """
        )
        rows = cur.fetchall()
        if not rows:
            print("(stocks is empty – did you run COPY yet?)")
        else:
            for row in rows:
                symbol, ts, open_, high, low, close, volume = row
                print(f"{symbol} {ts}: open={open_} close={close} vol={volume}")

# ---- 3. Main menu loop ----
def main():
    print("Connecting to database...")
    conn = get_connection()
    print("✅ Connected to stockdb on port 5433")

    try:
        while True:
            print("\n=== Main Menu ===")
            print("1) Register new user")
            print("2) List users")
            print("3) Show 5 rows from stocks")
            print("0) Quit")
            choice = input("Choose an option: ").strip()

            if choice == "1":
                register_user(conn)
            elif choice == "2":
                list_users(conn)
            elif choice == "3":
                show_stocks_sample(conn)
            elif choice == "0":
                print("Bye!")
                break
            else:
                print("Invalid choice. Try again.")
    finally:
        conn.close()
        print("Connection closed.")

if __name__ == "__main__":
    main()
