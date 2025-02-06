use std::collections::HashMap;

use regex::Regex;

use crate::handlers::error::{BotErr, BotError, Error, ErrorKind, ErrorOrigin};

/// Transforms a given string into milliseconds.
///
/// The given string is expected to have the following format: `number operator unit`
/// where `number` is a number, `operator` is either `+` or `-`, and `unit` is one of the
/// following: `s` for seconds, `min` for minutes, `h` for hours, `d` for days, `w` for weeks,
/// `m` for months, and `y` for years.
///
/// The function will iterate over the string, separating it into parts. If a part is an operator,
/// it will be stored in a vector. If a part is not an operator, it will be transformed into
/// milliseconds and added to another vector.
///
/// The function will then iterate over the vector of operations and calculate the result of the
/// string.
///
/// For example, if the given string is `1d-2h+3min`, the function will return `93600000` (1 day
/// minus 2 hours plus 3 minutes in milliseconds).
///
/// # Errors
///
/// The function will return an error if the given string is empty, if the string contains an
/// invalid operator, if the string contains an invalid unit, if the string contains an invalid
/// number, or if the string does not match the expected format.
pub fn limit_to_milli(mut limit: String) -> Result<u64, BotErr> {
    limit = limit.replace(" ", "");

    let mut units = HashMap::new();
    {
        units.insert("s", 1000);
        units.insert("min", 1000 * 60);
        units.insert("h", 1000 * 60 * 60);
        units.insert("d", 1000 * 60 * 60 * 24);
        units.insert("w", 1000 * 60 * 60 * 24 * 7);
        units.insert("m", 1000 * 60 * 60 * 24 * 30);
        units.insert("y", 1000 * 60 * 60 * 24 * 365);
    }
    let operators = ["+", "-"];

    let units_regex = r"(s|min|h|d|w|m|y)";
    let numbers_regex = r"(\d+)";
    let mut divisors_regex = vec!["([".to_string()];
    {
        for operator in &operators {
            divisors_regex.push(format!(r"\{}", operator));
        }
        divisors_regex.push("])".to_string());
    }
    let limit_regex = Regex::new(&divisors_regex.join("")).unwrap();

    let limit_len = limit.len();
    let mut limit_parts = vec![];
    let mut operations_in_milli: Vec<String> = vec![];
    let mut limit_milli: u64 = 0;

    {
        let mut last_index = 0;
        for mat in limit_regex.find_iter(&limit) {
            if mat.start() != last_index {
                limit_parts.push(limit[last_index..mat.start()].to_string());
            }

            limit_parts.push(mat.as_str().to_string());
            last_index = mat.end();
        }
        if last_index == 0 || last_index < limit_len {
            limit_parts.push(limit[last_index..limit_len].to_string())
        } else {
            return Err(BotError::new(
                t!("syntax.limit.end_operators").to_string(),
                ErrorKind::SyntaxError,
                ErrorOrigin::User,
            ));
        }

        // Transform the values into milliseconds and place them in the operations vector
        for (_, limit_part) in limit_parts.iter().enumerate() {
            if operators.contains(&limit_part.as_str()) {
                if operations_in_milli.len() == 0 && limit_part == operators[0] {
                    continue;
                }

                operations_in_milli.push(limit_part.to_string());
            } else {
                let wrong_unit_syntax_err = BotError::new(
                    t!("syntax.limit.unit_syntax_err").to_string(),
                    ErrorKind::SyntaxError,
                    ErrorOrigin::User,
                );
                let unit_parts = Regex::new(format!("{}{}", numbers_regex, units_regex).as_str())
                    .unwrap()
                    .captures(limit_part);

                if let Some(unit_parts) = unit_parts {
                    let unit_len = unit_parts.len();

                    if unit_len != 3 {
                        return Err(wrong_unit_syntax_err);
                    }

                    if limit_part != unit_parts.get(0).unwrap().as_str() {
                        return Err(BotError::new(
                            t!("syntax.limit.invalid_unit_match").to_string(),
                            ErrorKind::SyntaxError,
                            ErrorOrigin::User,
                        ));
                    }

                    let unit_number = unit_parts.get(1).unwrap().as_str().parse::<i64>().unwrap();

                    if let Some(unit) = units.get(unit_parts.get(2).unwrap().as_str()) {
                        operations_in_milli.push((unit_number * unit).to_string());

                        continue;
                    }
                }

                return Err(wrong_unit_syntax_err);
            }
        }

        // Calculate operations
        let mut last_operator = operators[0];
        for (_, operation) in operations_in_milli.iter().enumerate() {
            if operators.contains(&operation.as_str()) {
                last_operator = operation;
            } else {
                if last_operator == operators[0] {
                    limit_milli += operation.parse::<u64>().unwrap();
                } else {
                    limit_milli -= operation.parse::<u64>().unwrap();
                }
            }
        }
    }

    Ok(limit_milli)
}
