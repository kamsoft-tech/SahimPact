import sqlite3

c = sqlite3.connect('iyipl.db').cursor()
c.execute("SELECT id FROM accounts WHERE name='Contingency Reserve' AND company_id=3")
a = c.fetchone()
if a:
    print("Acc:", a[0])
    c.execute(f"SELECT sum(amount) FROM journal_entries WHERE account_id={a[0]} AND type='CREDIT'")
    cr = c.fetchone()[0] or 0.0
    c.execute(f"SELECT sum(amount) FROM journal_entries WHERE account_id={a[0]} AND type='DEBIT'")
    db = c.fetchone()[0] or 0.0
    print("Cr:", cr, "Db:", db, "Balance:", cr - db)
else:
    print("No Contingency Reserve account found for company 3")
