import { useEffect, useState } from 'react';
import {
  Box,
  Heading,
  SimpleGrid,
  Card,
  CardBody,
  CardHeader,
  Button,
  FormControl,
  FormLabel,
  Input,
  Select,
  VStack,
  HStack,
  Text,
  Icon,
  useToast,
} from '@chakra-ui/react';
import { FiFileText, FiClock, FiTrendingUp, FiDownload } from 'react-icons/fi';
import MainLayout from '../components/Layout/MainLayout';
import { dashboardAPI, downloadFile } from '../services/api';

const Reports = () => {
  const toast = useToast();
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [lateLoading, setLateLoading] = useState(false);
  const [overtimeLoading, setOvertimeLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  
  // Report filters
  const [attendanceFilters, setAttendanceFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    employeeId: 'all',
  });

  const [lateFilters, setLateFilters] = useState({
    startDate: '',
    endDate: '',
    employeeId: 'all',
  });

  const [overtimeFilters, setOvertimeFilters] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    employeeId: 'all',
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await dashboardAPI.getAllEmployees({ isActive: true });
        setEmployees(data.employees || []);
      } catch (error) {
        console.error('Failed to load employees', error);
        toast({
          title: 'خطأ',
          description: error.message || 'فشل تحميل قائمة الموظفين',
          status: 'error',
          duration: 4000,
        });
      }
    };
    fetchEmployees();
  }, [toast]);

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleGenerateAttendanceReport = async () => {
    try {
      setAttendanceLoading(true);

      const params = new URLSearchParams({
        month: attendanceFilters.month,
        year: attendanceFilters.year,
        format: 'pdf',
      });

      if (attendanceFilters.employeeId) {
        params.append('userId', attendanceFilters.employeeId);
      }

      const blob = await downloadFile(`/reports/monthly?${params.toString()}`);
      const monthLabel = new Date(attendanceFilters.year, attendanceFilters.month - 1).toLocaleDateString('ar-JO', { month: 'long' });
      const employeeLabel =
        attendanceFilters.employeeId === 'all'
          ? 'all'
          : attendanceFilters.employeeId;
      downloadBlob(blob, `attendance-${employeeLabel}-${monthLabel}-${attendanceFilters.year}.pdf`);

      toast({
        title: 'تم إنشاء التقرير',
        description: 'تم تحميل تقرير الحضور الشهري بنجاح',
        status: 'success',
        duration: 3000,
      });
      setAttendanceLoading(false);
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إنشاء التقرير',
        status: 'error',
        duration: 3000,
      });
      setAttendanceLoading(false);
    }
  };

  const handleGenerateLateReport = async () => {
    try {
      if (!lateFilters.startDate || !lateFilters.endDate) {
        toast({
          title: 'تنبيه',
          description: 'الرجاء تحديد تاريخ البداية والنهاية',
          status: 'warning',
          duration: 3000,
        });
        return;
      }

      if (new Date(lateFilters.startDate) > new Date(lateFilters.endDate)) {
        toast({
          title: 'تنبيه',
          description: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
          status: 'warning',
          duration: 3000,
        });
        return;
      }

      setLateLoading(true);

      const params = new URLSearchParams({
        startDate: lateFilters.startDate,
        endDate: lateFilters.endDate,
        format: 'pdf',
      });

      if (lateFilters.employeeId && lateFilters.employeeId !== 'all') {
        params.append('userId', lateFilters.employeeId);
      }

      const blob = await downloadFile(`/reports/late?${params.toString()}`);
      downloadBlob(
        blob,
        `late-${lateFilters.startDate}-${lateFilters.endDate}.pdf`
      );

      toast({
        title: 'تم إنشاء التقرير',
        description: 'تم تحميل تقرير التأخيرات بنجاح',
        status: 'success',
        duration: 3000,
      });
      setLateLoading(false);
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إنشاء التقرير',
        status: 'error',
        duration: 3000,
      });
      setLateLoading(false);
    }
  };

  const handleGenerateOvertimeReport = async () => {
    try {
      setOvertimeLoading(true);

      const params = new URLSearchParams({
        month: overtimeFilters.month,
        year: overtimeFilters.year,
        format: 'pdf',
      });

      if (overtimeFilters.employeeId) {
        params.append('userId', overtimeFilters.employeeId);
      }

      const blob = await downloadFile(`/reports/overtime?${params.toString()}`);
      const monthLabel = new Date(overtimeFilters.year, overtimeFilters.month - 1).toLocaleDateString('ar-JO', { month: 'long' });
      const employeeLabel =
        overtimeFilters.employeeId === 'all'
          ? 'all'
          : overtimeFilters.employeeId;
      downloadBlob(blob, `overtime-${employeeLabel}-${monthLabel}-${overtimeFilters.year}.pdf`);

      toast({
        title: 'تم إنشاء التقرير',
        description: 'تم تحميل تقرير العمل الإضافي بنجاح',
        status: 'success',
        duration: 3000,
      });
      setOvertimeLoading(false);
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل في إنشاء التقرير',
        status: 'error',
        duration: 3000,
      });
      setOvertimeLoading(false);
    }
  };

  const ReportCard = ({ title, description, icon, color, children, onGenerate, isLoading }) => (
    <Card>
      <CardHeader>
        <HStack spacing={3}>
          <Icon as={icon} boxSize={6} color={color} />
          <Box>
            <Heading size="md">{title}</Heading>
            <Text fontSize="sm" color="gray.600" mt={1}>{description}</Text>
          </Box>
        </HStack>
      </CardHeader>
      <CardBody>
        <VStack spacing={4} align="stretch">
          {children}
          <Button
            colorScheme="blue"
            leftIcon={<FiDownload />}
            onClick={onGenerate}
            isLoading={isLoading}
            size="lg"
          >
            تحميل التقرير (PDF)
          </Button>
        </VStack>
      </CardBody>
    </Card>
  );

  return (
    <MainLayout>
      <Box w="100%" maxW="100%" overflowX="hidden" boxSizing="border-box">
        <Heading 
          mb={6} 
          color="gray.700"
          fontSize={{ base: "lg", md: "xl", lg: "2xl" }}
          pl={{ base: 12, md: 0 }}
        >
          التقارير
        </Heading>
        
        <SimpleGrid columns={{ base: 1, lg: 2, xl: 3 }} spacing={6}>
          {/* Attendance Report */}
          <ReportCard
            title="تقرير الحضور الشهري"
            description="تقرير كامل لحضور الموظفين خلال شهر محدد"
            icon={FiFileText}
            color="blue.500"
            onGenerate={handleGenerateAttendanceReport}
            isLoading={attendanceLoading}
          >
            <FormControl>
              <FormLabel>الشهر</FormLabel>
              <Select
                value={attendanceFilters.month}
                onChange={(e) => setAttendanceFilters({
                  ...attendanceFilters,
                  month: parseInt(e.target.value)
                })}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleDateString('ar-JO', { month: 'long' })}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>السنة</FormLabel>
              <Select
                value={attendanceFilters.year}
                onChange={(e) => setAttendanceFilters({
                  ...attendanceFilters,
                  year: parseInt(e.target.value)
                })}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <option key={i} value={new Date().getFullYear() - i}>
                    {new Date().getFullYear() - i}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>الموظف</FormLabel>
              <Select
                value={attendanceFilters.employeeId}
                onChange={(e) => setAttendanceFilters({
                  ...attendanceFilters,
                  employeeId: e.target.value
                })}
              >
                <option value="all">جميع الموظفين</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>
                    {emp.fullName} ({emp.employeeNumber})
                  </option>
                ))}
              </Select>
            </FormControl>
          </ReportCard>

          {/* Late Report */}
          <ReportCard
            title="تقرير التأخيرات"
            description="تقرير بجميع حالات التأخير خلال فترة محددة"
            icon={FiClock}
            color="orange.500"
            onGenerate={handleGenerateLateReport}
            isLoading={lateLoading}
          >
            <FormControl>
              <FormLabel>من تاريخ</FormLabel>
              <Input
                type="date"
                value={lateFilters.startDate}
                onChange={(e) => setLateFilters({
                  ...lateFilters,
                  startDate: e.target.value
                })}
              />
            </FormControl>

            <FormControl>
              <FormLabel>إلى تاريخ</FormLabel>
              <Input
                type="date"
                value={lateFilters.endDate}
                onChange={(e) => setLateFilters({
                  ...lateFilters,
                  endDate: e.target.value
                })}
              />
            </FormControl>

            <FormControl>
              <FormLabel>الموظف</FormLabel>
              <Select
                value={lateFilters.employeeId}
                onChange={(e) => setLateFilters({
                  ...lateFilters,
                  employeeId: e.target.value
                })}
              >
                <option value="all">جميع الموظفين</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>
                    {emp.fullName} ({emp.employeeNumber})
                  </option>
                ))}
              </Select>
            </FormControl>
          </ReportCard>

          {/* Overtime Report */}
          <ReportCard
            title="تقرير العمل الإضافي"
            description="تقرير بساعات العمل الإضافي لكل موظف"
            icon={FiTrendingUp}
            color="green.500"
            onGenerate={handleGenerateOvertimeReport}
            isLoading={overtimeLoading}
          >
            <FormControl>
              <FormLabel>الشهر</FormLabel>
              <Select
                value={overtimeFilters.month}
                onChange={(e) => setOvertimeFilters({
                  ...overtimeFilters,
                  month: parseInt(e.target.value)
                })}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2024, i).toLocaleDateString('ar-JO', { month: 'long' })}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>السنة</FormLabel>
              <Select
                value={overtimeFilters.year}
                onChange={(e) => setOvertimeFilters({
                  ...overtimeFilters,
                  year: parseInt(e.target.value)
                })}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <option key={i} value={new Date().getFullYear() - i}>
                    {new Date().getFullYear() - i}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>الموظف</FormLabel>
              <Select
                value={overtimeFilters.employeeId}
                onChange={(e) => setOvertimeFilters({
                  ...overtimeFilters,
                  employeeId: e.target.value
                })}
              >
                <option value="all">جميع الموظفين</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>
                    {emp.fullName} ({emp.employeeNumber})
                  </option>
                ))}
              </Select>
            </FormControl>
          </ReportCard>
        </SimpleGrid>
      </Box>
    </MainLayout>
  );
};

export default Reports;





