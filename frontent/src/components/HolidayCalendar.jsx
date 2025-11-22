import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Text,
  Badge,
  HStack,
  VStack,
  IconButton,
  Heading,
  Card,
  CardBody,
  Tooltip,
  useToast
} from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { holidaysAPI } from '../services/api';

const HolidayCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const daysOfWeek = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  useEffect(() => {
    fetchCalendar();
  }, [currentDate]);

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      const data = await holidaysAPI.getCalendar(year, month);
      setCalendarData(data.calendar || []);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل تحميل التقويم',
        status: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getTypeColor = (type) => {
    const colors = {
      national: 'red',
      religious: 'green',
      company: 'blue',
      custom: 'purple'
    };
    return colors[type] || 'gray';
  };

  return (
    <Card>
      <CardBody>
        {/* Header */}
        <HStack justify="space-between" mb={6}>
          <IconButton
            icon={<FiChevronRight />}
            onClick={handlePrevMonth}
            variant="ghost"
            aria-label="Previous month"
          />
          
          <Heading size="md">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </Heading>
          
          <IconButton
            icon={<FiChevronLeft />}
            onClick={handleNextMonth}
            variant="ghost"
            aria-label="Next month"
          />
        </HStack>

        {/* Days of Week Header */}
        <Grid templateColumns="repeat(7, 1fr)" gap={2} mb={2}>
          {daysOfWeek.map((day) => (
            <Box
              key={day}
              p={2}
              textAlign="center"
              fontWeight="bold"
              color="gray.600"
              fontSize="sm"
            >
              {day}
            </Box>
          ))}
        </Grid>

        {/* Calendar Grid */}
        <Grid templateColumns="repeat(7, 1fr)" gap={2}>
          {calendarData.map((dayData, index) => {
            const isToday = new Date().toDateString() === new Date(dayData.date).toDateString();
            const isFriday = dayData.dayOfWeek === 5; // Friday
            const isSaturday = dayData.dayOfWeek === 6; // Saturday

            return (
              <Tooltip
                key={index}
                label={
                  dayData.holidays.length > 0
                    ? dayData.holidays.map(h => h.nameAr || h.name).join(', ')
                    : ''
                }
                placement="top"
                hasArrow
              >
                <Box
                  p={3}
                  borderRadius="md"
                  border="1px"
                  borderColor={
                    isToday
                      ? 'blue.400'
                      : dayData.isHoliday
                      ? 'red.200'
                      : 'gray.200'
                  }
                  bg={
                    dayData.isHoliday
                      ? 'red.50'
                      : isFriday || isSaturday
                      ? 'gray.100'
                      : 'white'
                  }
                  cursor="pointer"
                  _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
                  transition="all 0.2s"
                >
                  <VStack spacing={1} align="stretch">
                    <Text
                      fontWeight={isToday ? 'bold' : 'normal'}
                      color={
                        isToday
                          ? 'blue.600'
                          : dayData.isHoliday
                          ? 'red.600'
                          : 'gray.800'
                      }
                      fontSize="lg"
                    >
                      {dayData.day}
                    </Text>
                    
                    {dayData.holidays.length > 0 && (
                      <VStack spacing={1} align="stretch">
                        {dayData.holidays.slice(0, 2).map((holiday, idx) => (
                          <Badge
                            key={idx}
                            colorScheme={getTypeColor(holiday.type)}
                            fontSize="xx-small"
                            textAlign="center"
                          >
                            {holiday.nameAr || holiday.name}
                          </Badge>
                        ))}
                        {dayData.holidays.length > 2 && (
                          <Text fontSize="xs" color="gray.500" textAlign="center">
                            +{dayData.holidays.length - 2} أخرى
                          </Text>
                        )}
                      </VStack>
                    )}
                    
                    {(isFriday || isSaturday) && !dayData.isHoliday && (
                      <Text fontSize="xs" color="gray.500" textAlign="center">
                        عطلة أسبوعية
                      </Text>
                    )}
                  </VStack>
                </Box>
              </Tooltip>
            );
          })}
        </Grid>

        {/* Legend */}
        <HStack spacing={4} mt={6} justify="center" flexWrap="wrap">
          <HStack>
            <Box w="12px" h="12px" bg="red.200" borderRadius="sm" />
            <Text fontSize="sm">عطلة رسمية</Text>
          </HStack>
          <HStack>
            <Box w="12px" h="12px" bg="gray.200" borderRadius="sm" />
            <Text fontSize="sm">عطلة أسبوعية</Text>
          </HStack>
          <HStack>
            <Box w="12px" h="12px" border="2px" borderColor="blue.400" borderRadius="sm" />
            <Text fontSize="sm">اليوم</Text>
          </HStack>
        </HStack>
      </CardBody>
    </Card>
  );
};

export default HolidayCalendar;


