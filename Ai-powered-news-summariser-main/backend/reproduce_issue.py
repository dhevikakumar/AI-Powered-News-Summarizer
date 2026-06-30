from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

try:
    print("Hashing 'secret':")
    hash1 = pwd_context.hash("secret")
    print(f"Success: {hash1}")
    
    print("\nHashing a longer password:")
    hash2 = pwd_context.hash("this_is_a_very_long_password_that_might_cause_issues_if_it_exceeds_72_bytes_which_is_bcrypt_limit")
    print(f"Success: {hash2}")

except Exception as e:
    import traceback
    with open("error_log.txt", "w") as f:
        f.write(f"Caught Exception: {type(e).__name__}: {e}\n")
        f.write(traceback.format_exc())
    print(f"\nCaught Exception: {type(e).__name__}: {e}")
